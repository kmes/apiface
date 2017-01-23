'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _AjaxAdapter = require('./AjaxAdapter');

var _AjaxAdapter2 = _interopRequireDefault(_AjaxAdapter);

var _FormDataAdapter = require('./FormDataAdapter');

var _FormDataAdapter2 = _interopRequireDefault(_FormDataAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//import FirebaseAdapter from './FirebaseAdapter';

exports.default = { AjaxAdapter: _AjaxAdapter2.default, FormDataAdapter: _FormDataAdapter2.default };