const initialProcess = function(item) {
  if (item.count) {
    return Promise.resolve(item);
  }
  else {
    return new Promise(function(resolve, reject) {
      console.log('initial process start...');
      setTimeout(function() {
        item.count = 0;
        console.log('initial process finished.');
        resolve(item);
      }, 1000);
    });
  }
};

const mainProcess = function(item) {
  return new Promise(function(resolve, reject) {
    const random = Math.random();
    console.log('main proceses', random);
    if (random > 0.1) {
      item.successCount = (item.successCount || 0) + 1;
      console.log('successCount', item.successCount);
      resolve(item);
    }
    else {
      reject(item);
    }
  });
};

const continuousProcessCreator = function(creator) {
  console.log('continusouProcessCreator called');
  console.log('continusouProcessCreator is', typeof creator);
  return function(item) {
    console.log('check continuous', item);
    if (item.successCount > 5) {
      return Promise.resolve(item);
    }
    else {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          resolve(item);
        });
      }).then(creator);
    }
  };
};

const completeProcess = function(item) {
  console.log('complete', item);
  return Promise.resolve(item);
};

const retryProcessCreator = function(creator) {
  console.log('retryProcessCreator called');
  console.log('retryProcessCreator is', typeof creator);
  const delayer = function(item) {
    return 500 * Math.pow(1.5, item.count);
  };
  return function(item) {
    item.count++;
    console.log('retry...');
    const delay = delayer(item);
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        resolve(item);
      }, delay);
      console.log("waiting.", delay);
    }).then(creator);
  }
}

function WorkerCreator(initialProcess, mainProcess, continuousProcessCreator, completeProcess, retryProcessCreator) {
  this.initialProcess = initialProcess;
  this.mainProcess = mainProcess;
  this.completeProcess = completeProcess;
  this.retryProcessCreator = retryProcessCreator;
  const self = this;
  this.workerCreator = function(item) {
    return Promise.resolve(item)
      .then(function(item) {
        return item;
      })
      .then(initialProcess)
      .then(mainProcess)
      .then(continuousProcessCreator(self.workerCreator))
      .then(completeProcess)
      .catch(retryProcessCreator(self.workerCreator));
  };
}

WorkerCreator.prototype.create = function(item) {
  return this.workerCreator(item);
};

function Queue(workerCreator, params = {}) {
  this.items = [];
  this.workerCreator = workerCreator;
  this.worker = null;
  this.period = params.period || 1000;
  this.initialDelayPromise = null;
  this.initialDelay = params.initialDelay || 1000;
  this.isStart = false;
}

Queue.prototype.addTask = function(item) {
  this.items.push(item);
  this.consume();
};

Queue.prototype.start = function() {
  const self = this;
  if (!self.initialDelayPromise) {
    self.initialDelayPromise = new Promise(function(resolve, reject) {
      console.log('initial delay...', self.initialDelay);
      setTimeout(function() {
        resolve();
      }, self.initialDelay);
    });
  }
  self.initialDelayPromise.then(function() {
    self.isStart = true;
    self.consume();
  });
};

Queue.prototype.stop = function() {
  this.isStart = false;
}


Queue.prototype.consume = function() {
  const self = this;
  if (self.isStart && self.items.length > 0 && self.worker === null) {
    const item = self.items.shift();
    self.worker = self.workerCreator.create(item).then(function(item) {
      console.log('sleeping...', self.period);
      setTimeout(function() {
        self.worker = null;
        self.consume();
      }, self.period);
    }).catch(function() {
      console.log('sleeping...', self.period);
      setTimeout(function() {
        self.worker = null;
        self.consume();
      }, self.period);
    });
    console.log("worker set");
  }
  else if (self.items.length === 0) {
    console.log('queue is empty.');
  }
};


//const queue = new Queue(new WorkerCreator(initialProcess, mainProcess, continuousProcessCreator, completeProcess, retryProcessCreator), { period: 1000, initialDelay: 1000 });
//queue.addTask({ "foo": "bar" });
//queue.addTask({ "foo": "wao" });
//queue.start();
module.exports = {
  Queue,
  WorkerCreator
};
