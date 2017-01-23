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

var FormDataAdapter = function (_AbstractHttpAdapter) {
    _inherits(FormDataAdapter, _AbstractHttpAdapter);

    function FormDataAdapter(_ref) {
        var url = _ref.url;

        _classCallCheck(this, FormDataAdapter);

        return _possibleConstructorReturn(this, (FormDataAdapter.__proto__ || Object.getPrototypeOf(FormDataAdapter)).call(this, { url: url }));
    }

    _createClass(FormDataAdapter, [{
        key: 'createData',
        value: function createData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('post', this.makeFormData(data));
        }
    }, {
        key: 'readData',
        value: function readData() {
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('get', this.makeFormData(params));
        }
    }, {
        key: 'updateData',
        value: function updateData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('post', this.makeFormData(data));
        }
    }, {
        key: 'makeFormData',
        value: function makeFormData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var formData = new FormData();

            for (var key in data) {
                var value = data[key];
                formData.append(key, value);
            }

            return formData;
        }
    }]);

    return FormDataAdapter;
}(_AbstractHttpAdapter3.default);

exports.default = FormDataAdapter;