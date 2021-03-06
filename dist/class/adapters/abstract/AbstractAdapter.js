'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _helper = require('../../helper/helper');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AbstractAdapter = function () {
    function AbstractAdapter(_ref) {
        var _ref$url = _ref.url,
            url = _ref$url === undefined ? '' : _ref$url,
            _ref$params = _ref.params,
            params = _ref$params === undefined ? {} : _ref$params;

        _classCallCheck(this, AbstractAdapter);

        this.baseUrl = url;
        this.uri = '';
        this.params = params;
        this.results = {};
        this.resetResults();
    }

    _createClass(AbstractAdapter, [{
        key: 'resetResults',
        value: function resetResults() {
            return this.results = {
                pendingToCreate: [],
                created: [],
                notCreated: [],

                pendingToRead: [],
                readed: [],
                notReaded: [],

                pendingToUpdate: [],
                updated: [],
                notUpdated: [],

                pendingToDelete: [],
                deleted: [],
                notDeleted: [],

                pendingToPush: [],
                pushed: [],
                notPushed: []
            };
        }
    }, {
        key: 'getParams',
        value: function getParams() {
            return this.params;
        }
    }, {
        key: 'setParams',
        value: function setParams() {
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            this.params = params;

            return this;
        }
    }, {
        key: 'getResults',
        value: function getResults() {
            return this.results;
        }
    }, {
        key: 'getPromise',
        value: function getPromise() {
            return (0, _helper.promiseFactory)();
        }
    }, {
        key: 'getBaseUrl',
        value: function getBaseUrl() {
            return this.baseUrl;
        }
    }, {
        key: 'setBaseUrl',
        value: function setBaseUrl(baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }
    }, {
        key: 'getUri',
        value: function getUri() {
            return this.uri;
        }
    }, {
        key: 'setUri',
        value: function setUri(uri) {
            this.uri = uri;
            return this;
        }
    }, {
        key: 'getUrl',
        value: function getUrl() {
            return this.baseUrl + this.uri;
        }
    }, {
        key: 'voidAction',
        value: function voidAction(name) {
            throw new Error(name + ' adapter\'s method is not defined');
        }
    }, {
        key: 'afterAction',
        value: function afterAction(_ref2, _ref3) {
            var pendingName = _ref2.pendingName,
                successName = _ref2.successName,
                errorName = _ref2.errorName;
            var node = _ref3.node,
                id = _ref3.id,
                error = _ref3.error;

            if (!error) {
                this.results[successName].push({
                    node: node,
                    id: id
                });
            } else {
                this.results[errorName].push({
                    node: node,
                    id: id
                });
            }

            for (var n in this.results[pendingName]) {
                var pendingNode = this.results[pendingName][n].pendingNode;

                if (pendingNode === node) {
                    this.results[pendingName].splice(n, 1);
                    break;
                }
            }

            return !this.results[pendingName].length;
        }
    }, {
        key: 'createData',
        value: function createData(data, checkIfExist) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterCreate',
        value: function afterCreate(_ref4) {
            var node = _ref4.node,
                id = _ref4.id,
                error = _ref4.error;

            return this.afterAction({ pendingName: 'pendingToCreate', successName: 'created', errorName: 'notCreated' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'readData',
        value: function readData(params) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterRead',
        value: function afterRead(_ref5) {
            var node = _ref5.node,
                id = _ref5.id,
                error = _ref5.error;

            return this.afterAction({ pendingName: 'pendingToRead', successName: 'readed', errorName: 'notReaded' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'updateData',
        value: function updateData(data, oldData) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterUpdate',
        value: function afterUpdate(_ref6) {
            var node = _ref6.node,
                id = _ref6.id,
                error = _ref6.error;

            return this.afterAction({ pendingName: 'pendingToUpdate', successName: 'updated', errorName: 'notUpdated' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'deleteData',
        value: function deleteData(params) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterDelete',
        value: function afterDelete(_ref7) {
            var node = _ref7.node,
                id = _ref7.id,
                error = _ref7.error;

            return this.afterAction({ pendingName: 'pendingToDelete', successName: 'deleted', errorName: 'notDeleted' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'pushData',
        value: function pushData(data) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterPush',
        value: function afterPush(_ref8) {
            var node = _ref8.node,
                id = _ref8.id,
                error = _ref8.error;

            return this.afterAction({ pendingName: 'pendingToPush', successName: 'pushed', errorName: 'notPushed' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'onChangeData',
        value: function onChangeData(callback) {
            return this.voidAction(arguments.callee.name);
        }
    }]);

    return AbstractAdapter;
}();

exports.default = AbstractAdapter;