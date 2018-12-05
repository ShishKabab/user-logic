const isPlainObject = require('lodash/fp/isPlainObject')
const isArray = require('lodash/fp/isArray')
import { LogicNode, DEFAULT_OPERATIONS } from "./operations"

export type UserLogicCreator = (definition) => UserLogic
export type ArrayUserLogicMap = {condition : UserLogic, content : UserLogicMap}[]
export type UserLogicMap = {[key : string] : UserLogic} | ArrayUserLogicMap
export type LookupReporter = (path : string[]) => void

export class UserLogic {
    private rootNode : LogicNode
    private baseContext

    constructor(
        {definition, operations, reportLookup, baseContext = {}} :
        {definition, operations?, reportLookup? : LookupReporter, baseContext?})
    {
        operations = {...DEFAULT_OPERATIONS, ...(operations || {})}

        // console.log('create logic', definition)
        this.rootNode = createLogicNode(definition, operations, reportLookup || (() => {}))
        this.baseContext = baseContext
    }

    evaluate(context) {
        return this.rootNode.evaluate({...this.baseContext, ...context})
    }
}

export function createLogicNode(definition, operations, reportLookup, childParse = null) : LogicNode {
    const parse = childParse || ((definition, {childParse = null} = {}) => {
        return createLogicNode(definition, operations, reportLookup, childParse)
    })

    let operation, preparedDefinition = definition
    if (typeof definition === 'string') {
        const firstChar = definition.substr(0, 1)
        if (firstChar === '$') {
            operation = operations.valueTemplate
            preparedDefinition = definition.substr(1)
        } else if (firstChar === '`') {
            if (definition.substr(-1) !== '`') {
                throw new Error('Template strings beginning with ` must end with a `: ' + definition)
            }
            operation = operations.stringTemplate
            preparedDefinition = definition.slice(1, -1)
        } else {
            operation = operations.literal
        }
    } else if (isArray(definition)) {
        operation = operations.array
    } else if (!isPlainObject(definition)) {
        operation = operations.literal
    } else {
        const operationName = Object.keys(definition)[0]
        operation = operations[operationName]
        if (!operation) {
            throw new Error('No such operation: ' + operationName)
        }
        preparedDefinition = definition[operationName]
    }

    return operation({
        definition: preparedDefinition,
        parse,
        reportLookup
    })
}

export function makeLogicMap(definitionMap, UserLogicClass : new ({definition}) => UserLogic = UserLogic) : UserLogicMap {
    if (typeof definitionMap === 'string') {
        return {$logic: new UserLogicClass({definition: definitionMap})}
    }
    if (isArray(definitionMap)) {
        return _makeArrayUserMap(definitionMap, UserLogicClass)
    }
    if (definitionMap['$logic']) {
        return {$logic: new UserLogicClass({definition: definitionMap['$logic']})}
    }

    const logicMap = {}
    for (const [key, value] of Object.entries(definitionMap || {})) {
        logicMap[key] = new UserLogicClass({definition: value})
    }
    return logicMap
}

function _makeArrayUserMap(definitionMap, UserLogicClass : new ({definition}) => UserLogic = UserLogic) : UserLogicMap {
    return definitionMap.map(element => {
        const entry = {content: element, condition: null}
        if (element.if) {
            entry.content = {...element}
            delete entry.content.if
            entry.condition = new UserLogicClass({definition: element.if})
        }
        entry.content = makeLogicMap(entry.content)

        return entry
    })
}

export function evalLogicMap(logicMap : UserLogicMap, context) {
    if (logicMap['$logic']) {
        return logicMap['$logic'].evaluate(context)
    }

    if (logicMap instanceof Array) {
        return _evalArrayUserLogicMap(logicMap, context)
    }

    const result = {}
    for (const [key, logic] of Object.entries(logicMap)) {
        result[key] = (<any>logic).evaluate(context)
    }
    return result
}

function _evalArrayUserLogicMap(logicMap : ArrayUserLogicMap, context) {
    const result = {}
    for (const entry of logicMap) {
        if (entry.condition && !entry.condition.evaluate(context)) {
            continue
        }

        Object.assign(result, evalLogicMap(entry.content, context))
    }
    return result
}
