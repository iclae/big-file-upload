import SparkMD5 from 'spark-md5';

function createChunks(file, chunkSize) {
  const chunks = [];
  for (let i = 0; i < file.size; i += chunkSize) {
    chunks.push(file.slice(i, i + chunkSize));
  }
  return chunks;
}

function calculateHash(chunks) {
  return new Promise(resolve => {
    const spark = new SparkMD5.ArrayBuffer();
    const hashChunks = [];

    function _read(i) {
      if (i >= chunks.length) {
        resolve([spark.end(), hashChunks]);
        return;
      }
      const blob = chunks[i];
      const reader = new FileReader();
      reader.onload = e => {
        const bytes = e.target.result;
        // 增量计算文件hash
        spark.append(bytes);
        // 计算单片hash
        const chunkHash = SparkMD5.ArrayBuffer.hash(bytes);
        hashChunks.push({
          index: i,
          blob,
          chunkHash,
        });
        _read(i + 1);
      };
      reader.readAsArrayBuffer(blob);
    }
    _read(0);
  });
}

async function getHash(chunks) {
  const [fileHash, hashChunks] = await calculateHash(chunks);
  self.postMessage([fileHash, hashChunks]);
}

self.onmessage = e => {
  const [file, chunkSize] = e.data;
  // 分片
  const chunks = createChunks(file, chunkSize);
  // 计算hash
  getHash(chunks);
};
