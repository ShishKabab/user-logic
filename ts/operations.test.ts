import { expect } from 'chai'
import { UserLogic } from '.'

const test = (definition, context, expected) => {
    expect(new UserLogic({definition}).evaluate(context)).to.deep.equal(expected)
}

describe('UserLogic operations', () => {
    it("should do 'not' ops", () => {
        test({not: true}, {}, false)
        test({not: false}, {}, true)
    })

    it("should do 'eq' ops", () => {
        test({eq: ['a', 'b']}, {}, false)
        test({eq: ['a', 'a']}, {}, true)
    })

    it("should do 'and' ops", () => {
        test({and: [true, false]}, {}, false)
        test({and: [true, true]}, {}, true)
        test({and: [true, true, false]}, {}, false)
    })

    it("should do 'or' ops", () => {
        test({or: [false, false]}, {}, false)
        test({or: [false, true]}, {}, true)
        test({or: [true, true]}, {}, true)
        test({or: [false, false, true]}, {}, true)
    })

    it("should do literals", () => {
        test({literal: {test: 4}}, {}, {test: 4})
        test({literal: {test: [1, 2, 3]}}, {}, {test: [1, 2, 3]})
        test({literal: {test: {foo: [1, 2, 3]}}}, {}, {test: {foo: [1, 2, 3]}})
        test({literal: {test: {$logic: {or: [false, 5]}}}}, {}, {test: 5})
        test({literal: {test: [{$logic: {or: [false, 5]}}]}}, {}, {test: [5]})
    })

    it("should do value templates", () => {
        test("$foo.bar", {foo: {bar: 5}}, 5)
    })

    it("should do string templates", () => {
        test("`Yes ${foo.bar}!`", {foo: {bar: 5}}, 'Yes 5!')
    })

    it("should do objects", () => {
        test({object: {foo: {not: 1}, bar: {and: [true, false]}}}, {}, {foo: false, bar: false})
    })

    it("should do object properties", () => {
        test({'object-property': [{literal: {foo: {bar: 3}}}, 'foo']}, {}, {bar: 3})
        test({'object-property': [{literal: {foo: {bar: 3}}}, 'foo.bar']}, {}, 3)
        test({'object-property': [{literal: {foo: {bar: 3}}}, 'foo', 'bar']}, {}, 3)
        test({'object-property': [
            {literal: {foo: {bar: 3}}},
            '$key',
            'bar'
        ]}, {key: 'foo'}, 3)
    })

    it('should do ifs', () => {
        test({'if': [true, 'yup', 'nope']}, {}, 'yup')
        test({'if': [false, 'yup', 'nope']}, {}, 'nope')
    })

    it('should do map', () => {
        test({'map': [['one', 'two'], "`${map.value}!`"]}, {}, ['one!', 'two!'])
        test({'map': [{'literal': {'first': 'one', 'second': 'two'}}, "`${map.key} ${map.value}!`"]}, {}, {'first': 'first one!', 'second': 'second two!'})
    })
})
