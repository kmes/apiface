'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _AbstractHttpAdapter2 = require('./abstract/AbstractHttpAdapter');

var _AbstractHttpAdapter3 = _interopRequireDefault(_AbstractHttpAdapter2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AjaxAdapter = function (_AbstractHttpAdapter) {
    _inherits(AjaxAdapter, _AbstractHttpAdapter);

    function AjaxAdapter(_ref) {
        var url = _ref.url;

        _classCallCheck(this, AjaxAdapter);

        return _possibleConstructorReturn(this, (AjaxAdapter.__proto__ || Object.getPrototypeOf(AjaxAdapter)).call(this, { url: url }));
    }

    _createClass(AjaxAdapter, [{
        key: 'createData',
        value: function createData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('post', data);
        }
    }, {
        key: 'readData',
        value: function readData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('get', data);
        }
    }, {
        key: 'updateData',
        value: function updateData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('post', data);
        }

        /*pushData( params = {} ) {
         return this.ajaxCall( 'post', params );
         }*/

    }]);

    return AjaxAdapter;
}(_AbstractHttpAdapter3.default);

exports.default = AjaxAdapter;