import { expect } from 'chai'
import { UserLogic, makeLogicMap, evalLogicMap } from '.'

const test = (definition, context, expected) => {
  expect(new UserLogic({definition}).evaluate(context)).to.deep.equal(expected)
}

describe('UserLogic', () => {
  it('should evaluate arrays', () => {
    test(['$foo', 'bar'], {foo: 'test'}, ['test', 'bar'])
  })

  it('should report lookups', () => {
    const lookups = []
    const logic = new UserLogic({definition: {eq: ['$foo.test', 5]}, reportLookup: path => lookups.push(path)})
    expect(lookups).to.deep.equal([
      ['foo', 'test']
    ])
  })

  describe('logic maps', () => {
    it('should create simple logic maps', () => {
      expect(evalLogicMap(makeLogicMap({
        foo: {concat: ['$test', 'b']},
        bar: {concat: ['$test', 'c']},
      }), {test: 'a'})).to.deep.equal({foo: 'ab', bar: 'ac'})
    })

    it('should create logic maps with top-level logic', () => {
      expect(evalLogicMap(makeLogicMap({$logic: {object: {
        foo: {concat: ['$test', 'b']},
        bar: {concat: ['$test', 'c']},
      }}}), {test: 'a'})).to.deep.equal({foo: 'ab', bar: 'ac'})
    })

    it('should create logic maps with a value template', () => {
      expect(evalLogicMap(makeLogicMap('$test'), {test: {foo: 'ab', bar: 'ac'}})).to.deep.equal({foo: 'ab', bar: 'ac'})
    })

    it('should handle conditional values', () => {
      expect(evalLogicMap(makeLogicMap([
        {spam: 'foo'},
        {if: {eq: [5, 5]}, ham: 'bar'},
        {if: {eq: [5, 8]}, eggs: 'baz'},
      ]), {})).to.deep.equal({
        spam: 'foo',
        ham: 'bar'
      })
    })
  })
})
