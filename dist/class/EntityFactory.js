'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _BaseEntity = require('./entities/BaseEntity');

var _BaseEntity2 = _interopRequireDefault(_BaseEntity);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EntityFactory = function () {
    function EntityFactory() {
        _classCallCheck(this, EntityFactory);
    }

    _createClass(EntityFactory, [{
        key: 'make',
        value: function make(_ref) {
            var _ref$uri = _ref.uri,
                uri = _ref$uri === undefined ? '' : _ref$uri,
                _ref$name = _ref.name,
                name = _ref$name === undefined ? null : _ref$name,
                _ref$fixedParams = _ref.fixedParams,
                fixedParams = _ref$fixedParams === undefined ? {} : _ref$fixedParams,
                _ref$entityClass = _ref.entityClass,
                entityClass = _ref$entityClass === undefined ? _BaseEntity2.default : _ref$entityClass;


            if (!uri && !name) return null;

            return new entityClass({
                name: name || uri,
                uri: uri,
                fixedParams: fixedParams
            });
        }
    }]);

    return EntityFactory;
}();

exports.default = EntityFactory;