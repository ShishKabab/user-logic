const isPlainObject = require('lodash/fp/isPlainObject')
const fromPairs = require('lodash/fp/fromPairs')
import * as objectPath from 'object-path'

export const DEFAULT_OPERATIONS : {[name : string] : LogicNodeCreator} = {
    literal: literalNode,
    valueTemplate: valueTemplateNode,
    stringTemplate: stringTemplateNode,
    if: ifNode,
    typeof: unaryOperation(value => typeof value()),
    
    not: unaryOperation(value => !value()),
    and: binaryOperation((left, right) => left() && right()),
    or: binaryOperation((left, right) => left() || right()),
    eq: binaryOperation((left, right) => left() === right()),
    gt: binaryOperation((left, right) => left() > right()),
    gte: binaryOperation((left, right) => left() >= right()),
    lt: binaryOperation((left, right) => left() < right()),
    lte: binaryOperation((left, right) => left() <= right()),
    
    array: arrayNode,
    object: objectNode,
    'object-property': objectPropertyNode,
    map: mapNode,
    debug: debugNode,

    capitalize: unaryOperation((value : () => string) => {
        const evaluated = value()
        return evaluated.substr(0, 1).toUpperCase() + evaluated.substr(1)
    }),
    concat: binaryOperation((left : () => string, right : () => string) => left() + right()),
    split: complexOperation(([value, separator] : [() => string, () => string]) => value().split(separator())),
    join: complexOperation(([value, separator] : [() => string[], () => string]) => value().join(separator())),
}

export type LogicNodeCreator = ({definition, parse, reportLookup}) => LogicNode

export interface LogicNode {
    evaluate(context)
}

export function literalNode({definition, parse}) {
    let evaluate
    if (definition instanceof Array) {
        const children = definition.map(child => literalNode({definition: child, parse}))
        evaluate = context => children.map(child => child.evaluate(context))
    } else if (definition && definition['$logic']) {
        const child = parse(definition['$logic'])
        evaluate = context => child.evaluate(context)
    } else if (isPlainObject(definition)) {
        const children = Object.entries(definition).map(([key, child]) => [key, literalNode({definition: child, parse})])
        evaluate = context => {
            return fromPairs(children.map(([key, child]) => [key, child['evaluate'](context)]))
        }
    } else {
        evaluate = () => definition
    }
    
    return { evaluate }
}

export function valueTemplateNode({definition, reportLookup}) {
    const path = definition.split('.')
    reportLookup(path)

    const self = {
        path,
        evaluate: context => {
            return objectPath['withInheritedProps'].get(context, self.path)
        }
    }
    return self
}

export function stringTemplateNode({definition, parse}) {
    return {
        evaluate: context => {
            return definition.replace(/\$\{([^}]+)}/g, function (all, name) {
                const value = parse(`$${name}`).evaluate(context)
                return typeof value !== 'undefined' ? value : all
            })
        }
    }
}

export function ifNode({definition, parse}) {
    const [condition, ifTrue, ifFalse] = definition.map(parse)
    return {
        evaluate: context => {
            if (condition.evaluate(context)) {
                return ifTrue.evaluate(context)
            } else {
                return ifFalse.evaluate(context)
            }
        }
    }
}

export function complexOperation(evaluate : (values : Array<() => any>) => any) : LogicNodeCreator {
    return ({definition, parse}) => {
        const nodes = definition.map(parse)
        return {
            evaluate: (context) => evaluate(nodes.map(node => () => node.evaluate(context)))
        }
    }
}

export function unaryOperation(evaluate : (value : () => any) => any) : LogicNodeCreator {
    return ({definition, parse}) => {
        const node = parse(definition)
        return {
            evaluate: (context) => evaluate(() => node.evaluate(context))
        }
    }
}

export function binaryOperation(evaluatePair : (left : any, right : any) => any) {
    return ({definition, parse}) => {
        const nodes = definition.map(parse)
        return {
            evaluate: (context) => {
                let left = () => nodes[0].evaluate(context)
                for (let i = 0; i < nodes.length - 1; ++i) {
                    const right = () => nodes[i + 1].evaluate(context)
                    const result = evaluatePair(left, right)
                    left = () => result
                }
                return left()
            }
        }
    }
}

export function arrayNode({definition, parse}) {
    const nodes = definition.map(nodeDefinition => parse(nodeDefinition))
    
    return {
        evaluate: context => {
            return nodes.map(node => node.evaluate(context))
        }
    }
}

export function objectNode({definition, parse}) {
    const nodePairs = []
    for (const [key, valueDefinition] of Object.entries(definition)) {
        nodePairs.push([key, parse(valueDefinition)])
    }

    return {
        evaluate: context => {
            const value = {}
            for (const [key, node] of nodePairs) {
                value[key] = node.evaluate(context)
            }
            return value
        }
    }
}

export function objectPropertyNode({definition, parse}) {
    const nodes = definition.map(nodeDefinition => parse(nodeDefinition))

    return {
        evaluate: context => {
            const values = nodes.map(node => node.evaluate(context))
            let final = values[0]
            for (const key of values.slice(1)) {
                final = objectPath.get(final, key)
            }
            return final
        }
    }
}

export function mapNode({definition, parse}) {
    const sourceNode = parse(definition[0])
    const funcNode = parse(definition[1])

    return {
        evaluate: context => {
            const source = sourceNode.evaluate(context)
            if (isPlainObject(source)) {
                const mapped = {}
                for (const [key, value] of Object.entries(source)) {
                    mapped[key] = funcNode.evaluate({
                        ...context,
                        map: {value, key}
                    })
                }
                return mapped
            } else {
                return source.map((value, index) => {
                    return funcNode.evaluate({
                        ...context,
                        map: {value, index}
                    })
                })
            }
        }
    }
}

export function debugNode({definition, parse}) {
    let counter = 0
    const debugParse = childDefinition => {
        const node = parse(childDefinition, {childParse: debugParse})
        return {
            evaluate: context => {
                const id = ++counter
                const op = Object.keys(childDefinition)[0]
                console.log('USER-LOGIC (%d): evaluating %o with context %o', id, childDefinition, context)
                const result = node.evaluate(context)
                console.log('USER-LOGIC (%d): result = %o', id, result)
                return result
            }
        }
    }

    const node = debugParse(definition)
    return {
        evaluate: context => {
            return node.evaluate(context)
        }
    }
}
