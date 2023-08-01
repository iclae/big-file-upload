// @ts-ignore
import HashWorker from './worker/hash.worker.js?worker';
// @ts-ignore
import UploadWorker from './worker/upload.worker.js?worker';

const MB = 1024 * 1024;

const default_option = {
  uploadData: {},
  chunkUploadSuccessCode: 200,
  queryFileUploadStatusChunkHashKey: 'chunkHash',
  queryFileUploadStatusSuccessCode: 200,
  queryFileUploadStatusDataField: null,
  completeMethod: 'POST',
  completeBodyType: 'formData',
  completeSuccessCode: 200,
  completeDataField: 'filePath',
  chunkThreshold: 200,
  chunkSize: 20,
  createChunkUploadParam: [],
  createCompleteParam: [],
  onSpliting: () => void 0,
  onSplitEnd: () => void 0,
  onProgress: () => void 0,
  onComplete: () => void 0,
  onSuccess: () => void 0,
  onCancel: () => void 0,
  onError: () => void 0,
};

/**
 * 检查文件是否大于指定大小
 * @param {number} size MB
 * @param {number} chunkThreshold
 * @returns
 */
function isBigFile(size: number, chunkThreshold: number) {
  return size > chunkThreshold * MB;
}

/**
 * @typedef {array} ConstructArray
 * [key: string, valueKey: string][] 该数组的每一项都是一个数组，数组的第一个是上传参数的 key，第二个是uploadData 中的key，取出后会作为上传参数的值，valueKey 的格式是 string，可以用.分隔来取出深层的值
 * 构造上传参数时本身会注入 uploadData 一些文件的值供选择:
 * 通用的：
 * - fileHash: 文件 hash
 * - fileName: 文件名
 * - fileSize: 文件大小
 * - totalCount: 总分片数
 * 分片上传可以用到的：
 * - chunkSize: 分片大小
 * - chunk: 分片文件
 * - chunkIndex: 分片索引
 * - chunkHash: 分片 hash
 */

type ConstructArray = [string, string][];

/**
 * @typedef {Object} BigFileUploadOption
 * @property {string} chunkUploadUrl 分片上传地址
 * @property {string | number} chunkUploadSuccessCode 分片上传成功的 code
 * @property {number} chunkThreshold 大于该值的文件才会进行分片上传
 * @property {number} chunkSize 分片大小
 * @property {string} queryFileUploadStatusUrl 查询文件上传状态地址
 * @property {string} queryFileUploadStatusChunkHashKey 查询文件上传状态时，分片 hash 的 key
 * @property {string | number} queryFileUploadStatusSuccessCode 查询文件上传状态成功的 code
 * @property {null| string} queryFileUploadStatusDataField 取 data 哪个字段，null 是 data 本身
 * @property {string} completeUrl 合并文件请求地址
 * @property {'GET'|'POST'} completeMethod 合并文件请求方法
 * @property {'formData'|'json'} completeBodyType 合并文件请求体类型
 * @property {string | number} completeSuccessCode 合并文件成功的 code
 * @property {null| string} completeDataField 取 data 哪个字段，null 是 data 本身
 * @property {ConstructArray} createChunkUploadParam 分片上传参数构造数组
 * @property {ConstructArray} createCompleteParam 分片合并参数构造数组
 * @property {() => void} onSpliting 分片中
 * @property {() => void} onSplitEnd 分片结束
 * @property {(percent: number) => void} onProgress 上传中
 * @property {() => void} onComplete 合并中
 * @property {({filePath: string, fileHash: string}) => void} onSuccess 上传成功
 * @property {() => void} onCancel 上传取消
 * @property {(err: string) => void} onError 上传失败
 * @property {object} uploadData 上传参数
 */

interface BigFileUploadOption {
  chunkUploadUrl: string;
  chunkUploadSuccessCode: string | number;
  chunkThreshold: number;
  chunkSize: number;
  queryFileUploadStatusUrl: string;
  queryFileUploadStatusChunkHashKey: string;
  queryFileUploadStatusSuccessCode: string | number;
  queryFileUploadStatusDataField: null | string;
  completeUrl: string;
  completeMethod: 'GET' | 'POST';
  completeBodyType: 'formData' | 'json';
  completeSuccessCode: string | number;
  completeDataField: null | string;
  createChunkUploadParam: ConstructArray;
  createCompleteParam: ConstructArray;
  onSpliting: () => void;
  onSplitEnd: (fileHash: string) => void;
  onProgress: (percent: number) => void;
  onComplete: () => void;
  onSuccess: ({
    filePath,
    fileHash,
  }: {
    filePath: string;
    fileHash: string;
  }) => void;
  onCancel: () => void;
  onError: (err: string) => void;
  uploadData: object;
}

interface BigFileUploadType {
  option: BigFileUploadOption;
  file: File;
  upload(): void;
  cancelUpload(): void;
}

interface hashChunkType {
  chunkHash: string;
  chunk: Blob;
}

class BigFileUpload implements BigFileUploadType {
  option;
  file;
  private hashWorker = new HashWorker();
  private uploadWorker = new UploadWorker();
  constructor(file: File, option: BigFileUploadOption) {
    this.option = {
      ...default_option,
      ...option,
    };
    this.file = file;
    this.init();
  }

  private init() {
    this.hashWorker.onmessage = (e: {
      data: [fileHash: string, hashChunks: hashChunkType[]];
    }) => {
      const [fileHash, hashChunks] = e.data;
      this.option.onSplitEnd(fileHash);
      this.queryFileUploadStatus(fileHash, hashChunks);
    };
    this.uploadWorker.onmessage = (e: { data: any }) => {
      const { status, percent, successData, msg } = e.data;
      if (status === 'progress') {
        let resultPercent = percent;
        if (percent === 100) {
          resultPercent = 99;
        }
        this.option.onProgress(resultPercent);
      } else if (status === 'complete') {
        this.option.onComplete();
      } else if (status === 'done') {
        this.option.onProgress(100);
        this.option.onSuccess(successData);
      } else if (status === 'error') {
        this.option.onError(msg);
      }
    };
  }

  private splitFile() {
    this.hashWorker.postMessage([this.file, this.option.chunkSize * MB]);
  }
  // 查询文件上传状态
  private queryFileUploadStatus(fileHash: string, hashChunks: hashChunkType[]) {
    fetch(`${this.option.queryFileUploadStatusUrl}?fileHash=${fileHash}`)
      .then(res => res.json())
      .then(res => {
        const { code, data } = res;
        if (code !== this.option.queryFileUploadStatusSuccessCode) {
          this.option.onError('查询文件上传状态失败');
          return;
        }
        let finishData = data;
        if (this.option.queryFileUploadStatusDataField) {
          finishData = data[this.option.queryFileUploadStatusDataField];
        }
        const finishChunks = finishData.map(
          (item: { [key: string]: string }) =>
            item[this.option.queryFileUploadStatusChunkHashKey]
        );
        const toUploadChunks = hashChunks.filter(chunk => {
          return !finishChunks.includes(chunk.chunkHash);
        });
        this.uploadChunks(
          fileHash,
          finishChunks.length,
          toUploadChunks,
          hashChunks.length
        );
      });
  }

  private uploadChunks(
    fileHash: string,
    finishCount: number,
    hashChunks: hashChunkType[],
    totalCount: number
  ) {
    let percent = Math.floor((finishCount / totalCount) * 100);
    if (percent === 100) {
      percent = 99;
    }
    this.option.onProgress(percent);
    this.uploadWorker.postMessage({
      uploadData: this.option.uploadData,
      fileHash,
      fileName: this.file.name,
      fileSize: this.file.size,
      finishCount,
      totalCount,
      hashChunks,
      chunkUploadUrl: this.option.chunkUploadUrl,
      chunkUploadSuccessCode: this.option.chunkUploadSuccessCode,
      createChunkUploadParam: this.option.createChunkUploadParam,
      completeUrl: this.option.completeUrl,
      completeMethod: this.option.completeMethod,
      completeBodyType: this.option.completeBodyType,
      completeSuccessCode: this.option.completeSuccessCode,
      completeDataField: this.option.completeDataField,
      createCompleteParam: this.option.createCompleteParam,
    });
  }

  upload() {
    const file = this.file;
    if (!file) {
      this.option.onError('文件不存在');
      return;
    }
    const { size } = file;
    if (isBigFile(size, this.option.chunkThreshold)) {
      this.option.onSpliting();
      this.splitFile();
    } else {
      this.option.onError('文件过小');
    }
  }

  cancelUpload() {
    this.hashWorker.terminate();
    this.uploadWorker.terminate();
    this.option.onCancel();
  }
}

export { BigFileUpload, isBigFile };
