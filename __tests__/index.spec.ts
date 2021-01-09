import * as babel from '@babel/core'
import plugin from '../src'

const pluginOptions = [
  plugin,
  {
    packagesApis: new Map([
      ['@tarojs/taro-h5', new Set([
        'request',
        'setStorage',
        'getStorage',
        'createAnimation',
      ])],
    ]),
  }
]

it('should work!', function () {
  const code = `
    import Taro, { setStorage, initPxTransform, param } from '@tarojs/taro-h5';
    initPxTransform(param)
    Taro.initPxTransform()
    Taro.initPxTransform()
    Taro['getStorage']()
    setStorage()
    export { Taro }
  `
  const result = babel.transform(code, { plugins: [pluginOptions] })
  expect(result?.code).toMatchSnapshot()
})

it('should move static apis under "Taro"', () => {
  const code = `
    import { noop } from '@tarojs/taro-h5';
    noop;
    noop();
  `

  const result = babel.transform(code, { plugins: [pluginOptions] })
  expect(result?.code).toMatchSnapshot();
});

it('should not go wrong when using an api twice', () => {
  const code = `
    import Taro from '@tarojs/taro-h5';
    const animation = Taro.createAnimation({
      duration: dura * 1000,
      timingFunction: 'linear'
    })
    const resetAnimation = Taro.createAnimation({
      duration: 0,
      timingFunction: 'linear'
    })
  `
  expect(() => {
    const result = babel.transform(code, { plugins: [pluginOptions] })
    expect(result?.code).toMatchSnapshot()
  }).not.toThrowError()
});

it('should preserve default imports', function () {
  const code = `
    import Taro from '@tarojs/taro-h5'
    console.log(Taro)
  `
  const result = babel.transform(code, { plugins: [pluginOptions] })
  expect(result?.code).toMatchSnapshot()
})

it('should preserve assignments in lefthands', function () {
  const code = `
    import Taro from '@tarojs/taro-h5'
    let animation
    animation = Taro.createAnimation({
      transformOrigin: "50% 50%",
      duration: 1000,
      timingFunction: "ease",
      delay: 0
    });
    Taro.request()
    Taro.request = ''
    Taro['request'] = ''
  `
  const result = babel.transform(code, { plugins: [pluginOptions] })
  expect(result?.code).toMatchSnapshot()
})

it('should support rename of imported names', function () {
  const code = `
  // import { inject as mobxInject, observer as mobxObserver } from '@tarojs/mobx'
  import { Component as TaroComponent } from "@tarojs/taro-h5";
  export class Connected extends TaroComponent {}
  `
  const result = babel.transform(code, { plugins: [pluginOptions] })
  expect(result?.code).toMatchSnapshot()
})

it('should not import taro duplicatly', function () {
  const code = `
    import { Component } from "@tarojs/taro-h5";
    import Taro from '@tarojs/taro-h5';
    Component
    Taro.createAnimation()
    Taro.initPxTransform()
  `

  const result = babel.transform(code, { plugins: [pluginOptions] })
  expect(result?.code).toMatchSnapshot()
})

it('should not import default Taro', function () {
  const code = `
    import Taro from "@tarojs/taro-h5";
    Taro.createAnimation()
  `

  const result = babel.transform(code, { plugins: [pluginOptions] })
  expect(result?.code).toMatchSnapshot()
})
