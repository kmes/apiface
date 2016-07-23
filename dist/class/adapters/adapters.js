'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _AjaxAdapter = require('./AjaxAdapter');

var _AjaxAdapter2 = _interopRequireDefault(_AjaxAdapter);

var _FirebaseAdapter = require('./FirebaseAdapter');

var _FirebaseAdapter2 = _interopRequireDefault(_FirebaseAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = { AjaxAdapter: _AjaxAdapter2.default, FirebaseAdapter: _FirebaseAdapter2.default };