'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _helper = require('./helper/helper');

var _constants = require('./config/constants.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PowerEntity = function () {
    function PowerEntity(_ref) {
        var entity = _ref.entity,
            customAdapter = _ref.customAdapter,
            entityController = _ref.entityController,
            eventManager = _ref.eventManager,
            _ref$safeMode = _ref.safeMode,
            safeMode = _ref$safeMode === undefined ? false : _ref$safeMode;

        _classCallCheck(this, PowerEntity);

        this.entity = entity;
        this.entityController = entityController;
        this.customAdapter = customAdapter;

        this.eventManager = eventManager;

        this.nodeAdded = [];

        this.safeMode = safeMode;
        if (this.safeMode) {
            this.oldData = null;
        }
    }

    _createClass(PowerEntity, [{
        key: 'getEntity',
        value: function getEntity() {
            return this.entity;
        }
    }, {
        key: 'getEntityController',
        value: function getEntityController() {
            return this.entityController;
        }
    }, {
        key: 'getEventManager',
        value: function getEventManager() {
            return this.eventManager;
        }
    }, {
        key: 'getCreateAt',
        value: function getCreateAt() {
            return this.getEntity().getCreateAt();
        }
    }, {
        key: 'getUpdateAt',
        value: function getUpdateAt() {
            return this.getEntity().getUpdateAt();
        }
    }, {
        key: 'get',
        value: function get() {
            var entity = this.getEntity();
            return entity.get.apply(entity, arguments);
        }
    }, {
        key: 'set',
        value: function set() {
            var entity = this.getEntity();
            return entity.set.apply(entity, arguments);
        }
    }, {
        key: 'getData',
        value: function getData() {
            return this.getEntity().getData();
        }
    }, {
        key: 'setData',
        value: function setData(data) {
            if (!data) return false;

            if (this.safeMode) {
                this.oldData = Object.assing({}, this.getData());
            }

            this.getEntity().setData(data);

            return this;
        }
    }, {
        key: 'addData',
        value: function addData(node) {
            if (!node) return false;

            this.getEntity().addData(node);

            this.nodeAdded.push(node);
        }
    }, {
        key: 'getNodeAdded',
        value: function getNodeAdded() {
            return this.nodeAdded;
        }
    }, {
        key: 'resetNodeAdded',
        value: function resetNodeAdded() {
            return this.nodeAdded = [];
        }
    }, {
        key: 'fetch',
        value: function fetch() {
            var actionParams = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var promise = (0, _helper.promiseFactory)();

            var entity = this.getEntity();
            var entityController = this.getEntityController();
            var eventManager = this.getEventManager();

            entity.setActionParams(actionParams);
            var params = entity.getParams();

            var eventsName = (0, _helper.getEventsName)({
                method: 'fetch',
                dataStatus: entity.getStatus()
            });

            if (eventsName.request) {
                eventManager.trigger(eventsName.request, {
                    entity: entity,
                    params: params
                });
            }

            entity.setStatus(_constants.DATA_STATUS.busy);

            entityController.readData({ uri: entity.getUri(), params: params, adapter: this.customAdapter }).then(function (_ref2) {
                var data = _ref2.data,
                    response = _ref2.response;

                entity.setData(data);
                entity.setStatus(_constants.DATA_STATUS.synced);

                if (eventsName.success) {
                    eventManager.trigger(eventsName.success, {
                        entity: entity,
                        response: response
                    });
                }

                promise.resolve(entity);
            }).catch(function (_ref3) {
                var response = _ref3.response;

                entity.setStatus(_constants.DATA_STATUS.error);

                if (eventsName.error) {
                    eventManager.trigger(eventsName.error, {
                        entity: entity,
                        error: response
                    });
                }

                promise.reject(entity);
            });

            return promise.await;
        }
    }, {
        key: 'save',
        value: function save() {
            var actionParams = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var promise = (0, _helper.promiseFactory)();

            var entity = this.getEntity();
            var entityController = this.getEntityController();
            var eventManager = this.getEventManager();

            entity.setActionParams(actionParams);
            var params = entity.getParams();

            var eventsName = (0, _helper.getEventsName)({
                method: 'save',
                dataStatus: entity.getStatus()
            });

            if (eventsName.request) {
                eventManager.trigger(eventsName.request, {
                    entity: entity,
                    params: params
                });
            }

            var status = entity.getStatus();
            switch (status) {
                case _constants.DATA_STATUS.busy:
                case _constants.DATA_STATUS.pending:
                    if (eventsName.error) {
                        eventManager.trigger(eventsName.error, {
                            entity: entity,
                            error: status
                        });
                    }
                    promise.reject(entity);
                    break;
                case _constants.DATA_STATUS.synced:
                    if (eventsName.success) {
                        eventManager.trigger(eventsName.success, {
                            entity: entity,
                            response: entity.getData()
                        });
                    }
                    promise.resolve(entity);
                    break;
                case _constants.DATA_STATUS.created:
                    entityController.createData({ uri: entity.getUri(), data: entity.getData(), adapter: this.customAdapter, checkIfExist: this.safeMode }).then(function (_ref4) {
                        var data = _ref4.data,
                            response = _ref4.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);
                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }
                        promise.resolve(entity);
                    }).catch(function (_ref5) {
                        var response = _ref5.response;

                        entity.setStatus(_constants.DATA_STATUS.error);
                        if (eventsName.error) {
                            eventManager.trigger(eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }
                        promise.reject(entity);
                    });
                    break;
                case _constants.DATA_STATUS.modified:
                    entityController.updateData({ uri: entity.getUri(), data: entity.getData(), adapter: this.customAdapter, oldData: this.safeMode ? this.oldData : null }).then(function (_ref6) {
                        var data = _ref6.data,
                            response = _ref6.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);
                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }
                        promise.resolve(entity);
                    }).catch(function (_ref7) {
                        var response = _ref7.response;

                        entity.setStatus(_constants.DATA_STATUS.error);
                        if (eventsName.error) {
                            eventManager.trigger(eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }
                        promise.reject(entity);
                    });
                    break;
                case _constants.DATA_STATUS.added:
                    entityController.pushData({ uri: entity.getUri(), data: this.getNodeAdded(), adapter: this.customAdapter }).then(function (_ref8) {
                        var data = _ref8.data,
                            response = _ref8.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);

                        this.resetNodeAdded();

                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }

                        promise.resolve(entity);
                    }.bind(this)).catch(function (_ref9) {
                        var response = _ref9.response;

                        entity.setStatus(_constants.DATA_STATUS.error);

                        if (response && response.notAdded && response.notAdded.length) {
                            this.resetNodeAdded();
                            var _iteratorNormalCompletion = true;
                            var _didIteratorError = false;
                            var _iteratorError = undefined;

                            try {
                                for (var _iterator = response.notAdded[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                    var _ref11 = _step.value;
                                    var node = _ref11.node;

                                    this.nodeAdded.push(node);
                                }
                            } catch (err) {
                                _didIteratorError = true;
                                _iteratorError = err;
                            } finally {
                                try {
                                    if (!_iteratorNormalCompletion && _iterator.return) {
                                        _iterator.return();
                                    }
                                } finally {
                                    if (_didIteratorError) {
                                        throw _iteratorError;
                                    }
                                }
                            }
                        }

                        if (eventsName.error) {
                            eventManager.trigger(eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }

                        promise.reject(entity);
                    }.bind(this));
                    break;
                default:

                    break;
            }

            return promise.await;
        }
    }, {
        key: 'sync',
        value: function sync() {
            var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

            var promise = (0, _helper.promiseFactory)();

            var entity = this.getEntity();
            var entityController = this.getEntityController();
            var eventManager = this.getEventManager();

            var eventsName = (0, _helper.getEventsName)({
                method: 'sync',
                dataStatus: entity.getStatus()
            });

            if (eventsName.request) {
                eventManager.trigger(eventsName.request, {
                    entity: entity,
                    callback: callback
                });
            }

            entityController.onChangeData({ uri: entity.getUri(), adapter: this.customAdapter, callback: callback }).then(function (_ref12) {
                var data = _ref12.data,
                    response = _ref12.response;

                entity.setData(data);
                entity.setStatus(_constants.DATA_STATUS.synced);

                if (eventsName.success) {
                    eventManager.trigger(eventsName.success, {
                        entity: entity,
                        response: response
                    });
                }

                promise.resolve(entity);
            }).catch(function (_ref13) {
                var response = _ref13.response;

                entity.setStatus(_constants.DATA_STATUS.error);

                if (eventsName.error) {
                    eventManager.trigger(eventsName.error, {
                        entity: entity,
                        error: response
                    });
                }

                promise.reject(entity);
            });

            return promise.await;
        }
    }, {
        key: 'on',
        value: function on() {
            var eventName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
            var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};

            this.eventManager.addEventListener(eventName, function (response) {
                if (!response || !response.data || !response.data.entity) {
                    return false; //todo: throw new error
                }

                var promise = (0, _helper.promiseFactory)();

                if (response.data.entity == this.getEntity()) {
                    if (response && response.error) {
                        promise.reject.apply(this, arguments);
                    } else {
                        promise.resolve.apply(this, arguments);
                    }

                    callback.apply(this, arguments);
                }
            }.bind(this));
        }
    }]);

    return PowerEntity;
}();

exports.default = PowerEntity;