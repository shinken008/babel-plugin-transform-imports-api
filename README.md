## babel-plugin-transform-imports-api

[![NPM version](https://img.shields.io/npm/v/babel-plugin-transform-imports-api.svg)](https://www.npmjs.org/package/babel-plugin-transform-imports-api)
[![Build Status](https://travis-ci.org/shinken008/babel-plugin-transform-imports-api.svg?branch=main)](https://travis-ci.org/shinken008/babel-plugin-transform-imports-api)
[![Coverage Status](https://coveralls.io/repos/github/shinken008/babel-plugin-transform-imports-api/badge.svg?branch=main)](https://coveralls.io/github/shinken008/babel-plugin-transform-imports-api?branch=main)

Convert import default package API to modular reference to reduce package size and transforms member style imports. Inspired by [babel-plugin-transform-taroapi](https://www.npmjs.com/package/babel-plugin-transform-taroapi) and [babel-transform-imports](https://bitbucket.org/amctheatres/babel-transform-imports).

## example
```js
import Taro from '@tarojs/taro-h5'
Taro.request(...)
```
This code will become:
```js
import { request } from '@tarojs/taro-h5'
request(...)
```
and when the configure is:
```
// .babelrc
{
  packagesApis: new Map([
    ['@tarojs/taro-h5', new Set(['request'])],
  ]),
  usePackgesImport: true,
  packagesImport: {
    '@tarojs/taro-h5': {
      transform: (importName, matches) => `@tarojs/taro-h5/lib/${importName.toUpperCase()}`,
      preventFullImport: true,
    },
  }
}
```
this code will become:
```js
import request from '@tarojs/taro-h5/lib/request';
request(...)
```

## Usage
### Step 1: Install
```sh
yarn add --dev babel-plugin-transform-imports-api
```
or
```sh
npm install --save-dev babel-plugin-transform-imports-api
```
### Step 1: Configure .babelrc
```js
{
  plugins: [
    [require(plugin), {
      packagesApis: new Map([
        ['packageName1', new Set(['api'])],
        ['packageName2', new Set(['api'])],
      ]),
      usePackgesImport: false, // Whether to use packagesImport
      packagesImport: {
        'packageName1': {
          transform: (importName, matches) => `packageName1/lib/${importName.toUpperCase()}`,
          preventFullImport: true,
        },
      }
    }]
  ]
}
```

