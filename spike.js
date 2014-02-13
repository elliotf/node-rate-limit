#!/usr/bin/env node

var express = require('express')
  , app     = express()
;

function Limiter(opts) {
  this._window_len = opts.window_len || 10;
  this._max_per_window = opts.max_per_window || 20;
  this._max_delay = opts.max_delay || 4;
  this.state = {};
}

Limiter.prototype.getCurrentWindow = function() {
  var sec = Date.now() / 1000;
  sec = sec - sec % this._window_len;

  return sec;
};

Limiter.prototype.getWindows = function() {
  var current = this.getCurrentWindow();
  var windows = [
    current - this._window_len * 2, current - this._window_len, current
  ];

  return windows;
};

Limiter.prototype.getRatesForWindows = function(windows, done) {
  var self = this;
  console.log("STATE: ", this.state);

  process.nextTick(function() {
    var rates = [];
    for(var i = 0; i < windows.length; ++i) {
      rates.push(self.state[windows[i]] || 0);
    }

    rates[1] = (rates[0] + rates[1]) / 2;
    rates.shift();

    done(null, rates);
  });
};

Limiter.prototype.getCurrentRate = function(done) {
  var windows = this.getWindows();

  this.getRatesForWindows(windows, function(err, rates) {
    var current = Math.max.apply(null, rates);

    done(null, current);
  });
};

Limiter.prototype.tickCurrent = function() {
  var current = this.getCurrentWindow() + '';

  this.state[current] = (this.state[current] || 0) + 1;
};

Limiter.prototype.getMsDelay = function(done) {
  var max_per   = this._max_per_window;
  var window    = this._window_len;
  var max_delay = this._max_delay;

  this.getCurrentRate(function(err, current){
    var times_max_per = current / max_per;
    var ms_per_at_max = window / max_per;
    var delay         = times_max_per * ms_per_at_max * 2;
    delay             = Math.min(delay, max_delay);

    console.log("CURRENT RATE:", current);
    console.log("TIMES MAX    ", times_max_per);
    console.log("MS PER AT MAX", ms_per_at_max);
    console.log("DELAY:       ", delay);

    done(null, delay * 1000);
  });
};

Limiter.prototype.delay = function(fnToDelay) {
  var self = this;

  this.getMsDelay(function(err, delayBy){
    if (err) {
      console.warn(err);
      return fnToDelay();
    }
    self.tickCurrent();
    setTimeout(function() {
      fnToDelay();
      //self.tickCurrent();
    }, delayBy);
  });
};

Limiter.prototype.middleware = function(reqHash) {
  return function(req, res, next) {
    this.delay(next);
  }.bind(this);
};

var limiter = new Limiter({
  window_len: 10
  , max_per_window: 40
  , max_delay: 10
});

app.get('/', limiter.middleware(), function(req, res, next){
  res.send('ok');
});

app.listen(3000);
