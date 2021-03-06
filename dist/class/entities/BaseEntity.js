'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _constants = require('../config/constants.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BaseEntity = function () {
    function BaseEntity(_ref) {
        var uri = _ref.uri,
            name = _ref.name,
            _ref$fixedParams = _ref.fixedParams,
            fixedParams = _ref$fixedParams === undefined ? {} : _ref$fixedParams;

        _classCallCheck(this, BaseEntity);

        this.uri = uri;
        this.name = name;
        this.fixedParams = fixedParams;
        this.actionParams = {};
        this.params = Object.assign({}, this.fixedParams, this.actionParams);

        this.status = _constants.DATA_STATUS.pending; //1: pending to fetch, 2: modified, 3: synched

        this.data = null;

        this.createAt = new Date();
        this.updateAt = null;
    }

    _createClass(BaseEntity, [{
        key: 'getCreateAt',
        value: function getCreateAt() {
            return this.createAt;
        }
    }, {
        key: 'getUpdateAt',
        value: function getUpdateAt() {
            return this.updateAt;
        }
    }, {
        key: 'refreshUpdateAt',
        value: function refreshUpdateAt() {
            return this.updateAt = new Date();
        }
    }, {
        key: 'getName',
        value: function getName() {
            return this.name;
        }
    }, {
        key: 'getUri',
        value: function getUri() {
            return this.uri;
        }
    }, {
        key: 'setUri',
        value: function setUri() {
            var uri = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

            if (!uri || typeof uri !== 'string') return this.uri;
            return this.uri = uri;
        }
    }, {
        key: 'getFixedParams',
        value: function getFixedParams() {
            return this.fixedParams;
        }
    }, {
        key: 'setFixedParams',
        value: function setFixedParams() {
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

            if ((typeof params === 'undefined' ? 'undefined' : _typeof(params)) !== 'object' || typeof params.length !== 'undefined') {
                return this.fixedParams;
            }

            this.fixedParams = params;
            this.mergeParams();

            return this.fixedParams;
        }
    }, {
        key: 'getActionParams',
        value: function getActionParams() {
            return this.actionParams;
        }
    }, {
        key: 'setActionParams',
        value: function setActionParams() {
            var actionParams = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            this.actionParams = actionParams;
            this.mergeParams();

            return this.actionParams;
        }
    }, {
        key: 'getParams',
        value: function getParams() {
            return this.params;
        }
    }, {
        key: 'mergeParams',
        value: function mergeParams() {
            return this.params = _extends({}, this.getFixedParams(), this.getActionParams());
        }
    }, {
        key: 'getStatus',
        value: function getStatus() {
            return this.status;
        }
    }, {
        key: 'setStatus',
        value: function setStatus(status) {
            this.status = status;
        }
    }, {
        key: 'getData',
        value: function getData() {
            return this.data;
        }
    }, {
        key: 'setData',
        value: function setData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            this.data = data;
            this.setStatus(_constants.DATA_STATUS.modified);
            this.refreshUpdateAt();

            return this.getData();
        }
    }, {
        key: 'pushData',
        value: function pushData(data) {
            if (!data) return false;
            if (_typeof(this.data) !== 'object' || typeof this.data.push !== 'function') {
                return false;
            }

            this.data.push(data);

            this.setStatus(_constants.DATA_STATUS.added);
            this.refreshUpdateAt();
        }
    }, {
        key: 'get',
        value: function get(field) {
            var data = this.getData();
            return (typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object' ? data[field] : false;
        }
    }, {
        key: 'set',
        value: function set(field, value) {
            var data = this.getData();
            if (data === null) data = {};
            if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== 'object') return false;
            data[field] = value;

            return this.setData(data);
        }
    }]);

    return BaseEntity;
}();

exports.default = BaseEntity;