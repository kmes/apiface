'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _AbstractAdapter2 = require('./AbstractAdapter');

var _AbstractAdapter3 = _interopRequireDefault(_AbstractAdapter2);

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AbstractHttpAdapter = function (_AbstractAdapter) {
    _inherits(AbstractHttpAdapter, _AbstractAdapter);

    function AbstractHttpAdapter(config) {
        _classCallCheck(this, AbstractHttpAdapter);

        return _possibleConstructorReturn(this, (AbstractHttpAdapter.__proto__ || Object.getPrototypeOf(AbstractHttpAdapter)).call(this, config));
    }

    _createClass(AbstractHttpAdapter, [{
        key: 'httpCall',
        value: function httpCall(method, params) {
            var config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

            var promise = this.getPromise();

            console.log('httpCall', arguments);

            var newParams = null;
            if (params instanceof FormData && method != 'get') {
                newParams = params;
                for (var name in this.getParams()) {
                    var value = this.getParams()[name];
                    newParams.append(name, value);
                }
            } else {
                newParams = _extends({}, this.getParams(), params);
            }

            var data = {};
            if (method == 'get') {
                data = {
                    params: newParams
                };
            } else {
                data = newParams;
            }

            _axios2.default[method](this.getUrl(), data, config).then(function (resp) {
                console.log('then', resp);
                if (resp.status == 200) {
                    console.log('resolve');
                    promise.resolve({ response: resp, data: resp.data });
                } else {
                    promise.reject({ response: resp, data: resp.data });
                }
            }).catch(function (err) {
                console.log('catch', err);
                promise.reject({ response: err });
            });

            return promise.await;
        }
    }]);

    return AbstractHttpAdapter;
}(_AbstractAdapter3.default);

exports.default = AbstractHttpAdapter;