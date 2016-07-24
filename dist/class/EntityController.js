"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EntityController = function () {
    function EntityController(_ref) {
        var adapter = _ref.adapter;

        _classCallCheck(this, EntityController);

        //this.adapter = adapter;
        this.setAdapter(adapter);
    }

    _createClass(EntityController, [{
        key: "getAdapter",
        value: function getAdapter(_ref2) {
            var uri = _ref2.uri;
            var _ref2$params = _ref2.params;
            var params = _ref2$params === undefined ? {} : _ref2$params;
            var _ref2$adapter = _ref2.adapter;
            var adapter = _ref2$adapter === undefined ? null : _ref2$adapter;

            if (!adapter) adapter = this.adapter;

            adapter.setUri(uri);
            adapter.resetResults();

            return adapter;
        }
    }, {
        key: "setAdapter",
        value: function setAdapter(adapter) {
            return this.adapter = adapter;
        }
    }, {
        key: "createData",
        value: function createData(_ref3) {
            var uri = _ref3.uri;
            var _ref3$params = _ref3.params;
            var params = _ref3$params === undefined ? {} : _ref3$params;
            var _ref3$adapter = _ref3.adapter;
            var adapter = _ref3$adapter === undefined ? null : _ref3$adapter;
            var _ref3$checkIfExist = _ref3.checkIfExist;
            var checkIfExist = _ref3$checkIfExist === undefined ? false : _ref3$checkIfExist;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).createData(params, checkIfExist);
        } //return Promise

    }, {
        key: "readData",
        value: function readData(_ref4) {
            var uri = _ref4.uri;
            var _ref4$params = _ref4.params;
            var params = _ref4$params === undefined ? {} : _ref4$params;
            var _ref4$data = _ref4.data;
            var data = _ref4$data === undefined ? {} : _ref4$data;
            var _ref4$adapter = _ref4.adapter;
            var adapter = _ref4$adapter === undefined ? null : _ref4$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).readData(params);
        } //return Promise

    }, {
        key: "updateData",
        value: function updateData(_ref5) {
            var uri = _ref5.uri;
            var _ref5$params = _ref5.params;
            var params = _ref5$params === undefined ? {} : _ref5$params;
            var _ref5$data = _ref5.data;
            var data = _ref5$data === undefined ? {} : _ref5$data;
            var _ref5$adapter = _ref5.adapter;
            var adapter = _ref5$adapter === undefined ? null : _ref5$adapter;
            var _ref5$oldData = _ref5.oldData;
            var oldData = _ref5$oldData === undefined ? null : _ref5$oldData;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).updateData(data, oldData);
        } //return Promise

    }, {
        key: "deleteData",
        value: function deleteData(_ref6) {
            var uri = _ref6.uri;
            var _ref6$params = _ref6.params;
            var params = _ref6$params === undefined ? {} : _ref6$params;
            var _ref6$data = _ref6.data;
            var data = _ref6$data === undefined ? {} : _ref6$data;
            var _ref6$adapter = _ref6.adapter;
            var adapter = _ref6$adapter === undefined ? null : _ref6$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).deleteData(data);
        } //return Promise

    }, {
        key: "pushData",
        value: function pushData(_ref7) {
            var uri = _ref7.uri;
            var _ref7$params = _ref7.params;
            var params = _ref7$params === undefined ? {} : _ref7$params;
            var _ref7$data = _ref7.data;
            var data = _ref7$data === undefined ? {} : _ref7$data;
            var _ref7$adapter = _ref7.adapter;
            var adapter = _ref7$adapter === undefined ? null : _ref7$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).pushData(data);
        } //return Promise

    }, {
        key: "onChangeData",
        value: function onChangeData(_ref8) {
            var uri = _ref8.uri;
            var _ref8$params = _ref8.params;
            var params = _ref8$params === undefined ? {} : _ref8$params;
            var _ref8$data = _ref8.data;
            var data = _ref8$data === undefined ? {} : _ref8$data;
            var _ref8$adapter = _ref8.adapter;
            var adapter = _ref8$adapter === undefined ? null : _ref8$adapter;
            var _ref8$callback = _ref8.callback;
            var callback = _ref8$callback === undefined ? function () {} : _ref8$callback;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).onChangeData(callback);
        } //return Promise

    }]);

    return EntityController;
}();

exports.default = EntityController;