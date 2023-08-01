let fileHash = '';
let fileSize = 0;
let fileName = '';
let alreadyFinishCount = 0;
let totalCount = 0;
let chunkUploadUrl = '';
let chunkUploadSuccessCode;
let completeUrl = '';
let completeMethod;
let completeBodyType;
let completeSuccessCode;
let completeDataField;
let createChunkUploadParam = [];
let createCompleteParam = [];
let uploadData = {};

function get(obj, path, defaultValue = void 0) {
  // 将 path 分割为数组
  const keys = path.split('.');

  // 遍历访问 obj
  let result = obj;
  for (let key of keys) {
    result = result[key];

    // 如果访问不到返回默认值
    if (result === void 0) {
      return defaultValue;
    }
  }

  return result;
}

function getFileData() {
  return {
    fileHash,
    fileSize,
    fileName,
    totalCount,
  };
}

function objToGetParams(obj) {
  const params = new URLSearchParams();
  for (let key in obj) {
    params.append(key, obj[key]);
  }
  return params.toString();
}

function requestCompleteFile() {
  const data = {
    ...uploadData,
    ...getFileData(),
  };
  let params = {};
  createCompleteParam.forEach(kvk => {
    const [key, valueKey] = kvk;
    params[key] = get(data, valueKey);
  });

  if (completeMethod === 'GET') {
    return fetch(`${completeUrl}?${objToGetParams(params)}`);
  }
  if (completeBodyType === 'formData') {
    const formData = new FormData();
    Object.keys(params).forEach(key => {
      formData.append(key, params[key]);
    });
    return fetch(completeUrl, {
      method: 'POST',
      body: formData,
    });
  } else if (completeBodyType === 'json') {
    return fetch(completeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  }
}

function createFetchTask(hashChunk) {
  const { blob, chunkHash, index } = hashChunk;
  const data = {
    ...uploadData,
    ...getFileData(),
    chunkHash,
    chunkIndex: index,
    chunkSize: blob.size,
    chunk: blob,
  };
  const formData = new FormData();
  createChunkUploadParam.forEach(kvk => {
    const [key, valueKey] = kvk;
    formData.append(key, get(data, valueKey));
  });
  return fetch(chunkUploadUrl, {
    method: 'POST',
    body: formData,
  });
}

function paralleTask(tasks, parallelCount = 6) {
  return new Promise(resolve => {
    let allSuccess = true;
    if (tasks.length === 0) {
      resolve(allSuccess);
      return;
    }
    let nextIndex = 0;
    let finishCount = 0;
    function _run() {
      const task = tasks[nextIndex];
      nextIndex++;
      createFetchTask(task)
        .then(res => res.json())
        .then(res => {
          finishCount++;
          const { code } = res;
          if (code === chunkUploadSuccessCode) {
            // 进度计算 完成的数量 / 总数量+1 最后 1 留给合并文件
            postMessage({
              status: 'progress',
              percent: Math.floor(
                ((finishCount + alreadyFinishCount) / totalCount) * 100
              ),
            });
          } else {
            allSuccess = false;
          }
          if (nextIndex < tasks.length) {
            _run();
          } else if (finishCount === tasks.length) {
            resolve(allSuccess);
          }
        });
    }
    for (let i = 0; i < parallelCount && i < tasks.length; i++) {
      _run();
    }
  });
}

self.onmessage = function (e) {
  fileHash = e.data.fileHash;
  fileSize = e.data.fileSize;
  fileName = e.data.fileName;
  totalCount = e.data.totalCount;
  uploadData = e.data.uploadData;
  alreadyFinishCount = e.data.finishCount;
  chunkUploadUrl = e.data.chunkUploadUrl;
  chunkUploadSuccessCode = e.data.chunkUploadSuccessCode;
  completeUrl = e.data.completeUrl;
  createChunkUploadParam = e.data.createChunkUploadParam;
  createCompleteParam = e.data.createCompleteParam;
  completeMethod = e.data.completeMethod;
  completeBodyType = e.data.completeBodyType;
  completeSuccessCode = e.data.completeSuccessCode;
  completeDataField = e.data.completeDataField;

  paralleTask(e.data.hashChunks).then(allSuccess => {
    if (!allSuccess) {
      postMessage({ status: 'error', msg: '有文件未上传成功' });
      return;
    }
    postMessage({ status: 'complete' });
    requestCompleteFile()
      .then(res => res.json())
      .then(res => {
        const { code, data, msg } = res;
        if (code !== completeSuccessCode) {
          postMessage({ status: 'error', msg });
          return;
        }
        let completeData = data;
        if (completeDataField) {
          completeData = get(data, completeDataField);
        }
        postMessage({
          status: 'done',
          successData: {
            filePath: completeData,
            fileHash,
          },
        });
      });
  });
};
