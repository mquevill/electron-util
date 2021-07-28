'use strict';

const remote = require('@electron/remote/main');

const node = require('./node');

const common = require('./source/common');
const main = require('./source/main');
const renderer = require('./source/renderer');
const is = require('./source/is');

remote.initialize();

exports.common = common;
exports.main = main;
exports.renderer = renderer;
exports.is = is;

exports.electronVersion = node.electronVersion;

exports.fixPathForAsarUnpack = node.fixPathForAsarUnpack;
