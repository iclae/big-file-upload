# bigFileUpload

[![NPM version](https://img.shields.io/npm/v/bigFileUpload.svg?style=flat)](https://npmjs.org/package/bigFileUpload)
[![NPM downloads](http://img.shields.io/npm/dm/bigFileUpload.svg?style=flat)](https://npmjs.org/package/bigFileUpload)

## Install

```bash
$ npm install big-file-upload
```

## Use

最小可使用配置

Minimum Usable Configuration

```js
import { BigFileUpload } from 'big-file-upload'

const bigFileUpload = new BigFileUpload(targetBigFile, {
  chunkUploadUrl: 'chunkUploadUrl',
  createChunkUploadParam: [
    ['reqParamChunkHash', 'chunkHash'],
    ['reqParamChunkSize', 'chunkSize'],
    ['reqParamTotal', 'totalCount'],
    ['reqParamFileHash', 'fileHash'],
    ['reqParamFileSize', 'fileSize'],
    ['reqParamFileName', 'fileName'],
    ['reqParamBinary', 'chunk']
  ],
  queryFileUploadStatusUrl: 'queryFileUploadStatusUrl',
  queryFileUploadStatusChunkHashKey: 'chunkHash',
  completeUrl: 'completeUrl',
  createCompleteParam: [
    ['fileHash', 'fileHash'],
    ['fileSize', 'fileSize'],
    ['fileName', 'fileName'],
    ['sliceCount', 'totalCount']
  ],
  chunkThreshold: 200,
  chunkSize: 20,
  onProgress(percent) {
  },
  onSuccess({ filePath, fileHash }) {
  },
  onError() {
  }
 });
bigFileUpload.upload();
// bigFileUpload.cancelUpload()
```



## Options

#### chunkUploadUrl

分片上传url

#### chunkUploadSuccessCode

分片上传请求成功码 默认 200

#### chunkThreshold

分片阈值 单位 M 大于这个值才会上传

#### chunkSize

分片大小 M

#### queryFileUploadStatusUrl

 查询已上传文件的状态，已经上传了多少分片 根据已经上传的 chunkHash 来断点续传

#### queryFileUploadStatusChunkHashKey

查询已上传文件请求返回的 key来取值，例如返回的数据是这样的 [{chunkHash: '1', name:'xx'}, {chunkHash: '2', name: 'yy'}] queryFileUploadStatusChunkHashKey 就填 chunkHash，默认为 chunkHash，如果数据符合要求可不填

#### queryFileUploadStatusSuccessCode

查询已上传文件请求成功码 默认 200

#### queryFileUploadStatusDataField

查询已上传文件请求取哪个字段 eg: {code:200, data:{uploaded: []}} 可填uploaded 默认没有直接取 data 值，所以 data 最好是array

#### completeUrl

合并文件请求 url

#### completeMethod

合并请求 method    'GET' | 'POST'

#### completeBodyType

合并请求 method为POST 时，请求的方式 'formData' | 'json'

#### completeSuccessCode

合并请求成功码 默认 200

#### completeDataField

合并请求取值字段 默认filePath    eg: {code: 200, data:{filePath: 'xxxx'}}

#### uploadData

外部参数 配置后可在createChunkUploadParam和createCompleteParam中使用

#### createChunkUploadParam

分片上传参数, array 的第一个参数自己取, 第二个是固定的, 如果需要使用外部参数, 可在配置中增加 uploadData:{foo:1} 然后在这里增加一个['reqFoo', 'foo']

可用默认参数

 * fileHash: 文件 hash
 * fileName: 文件名
 * fileSize: 文件大小
 * totalCount: 总分片数
 * chunkSize: 分片大小
 * chunk: 分片文件
 * chunkIndex: 分片索引
 * chunkHash: 分片 hash

#### createCompleteParam

同createChunkUploadParam

可用默认参数

 * fileHash: 文件 hash
 * fileName: 文件名
 * fileSize: 文件大小
 * totalCount: 总分片数

### onSpliting

开始分片回调

#### onSplitEnd

分片结束，可拿到 fileHash， (fileHash:string) => void;

#### onProgress

可拿到进度 分片上传完毕是 99 合并文件成功后是 100

#### onComplete

合并文件成功

#### onSuccess

上传成功 (fileUrl: string) => void;

### onCancel

取消

#### onError

错误

## LICENSE

MIT
