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
    if (random > 0.7) {
      resolve(item);
    }
    else {
      reject(item);
    }
  });
};

const completeProcess = function(item) {
  console.log('complete', item);
  return Promise.resolve(item);
};

const retryProcessCreator = function(creator) {
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

function WorkerCreator(initialProcess, mainProcess, completeProcess, retryProcessCreator) {
  this.initialProcess = initialProcess;
  this.mainProcess = mainProcess;
  this.completeProcess = completeProcess;
  this.retryProcessCreator = retryProcessCreator;
  this.workerCreator = function(item) {
    return Promise.resolve(item)
      .then(initialProcess)
      .then(mainProcess)
      .then(completeProcess)
      .catch(retryProcessCreator(this.workerCreator));
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

// TBD
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
      console.log('return from worker', item);
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
};


//const queue = new Queue(new WorkerCreator(initialProcess, mainProcess, completeProcess, retryProcessCreator), { period: 10000, initialDelay: 5000 });
//queue.addTask({ "foo": "bar" });
//queue.addTask({ "foo": "wao" });

module.exports = {
  Queue,
  WorkerCreator
};
