'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _EventManager = require('./EventManager');

var _EventManager2 = _interopRequireDefault(_EventManager);

var _EntityContainer = require('./EntityContainer');

var _EntityContainer2 = _interopRequireDefault(_EntityContainer);

var _EntityController = require('./EntityController');

var _EntityController2 = _interopRequireDefault(_EntityController);

var _EntityFactory = require('./EntityFactory');

var _EntityFactory2 = _interopRequireDefault(_EntityFactory);

var _PowerEntity = require('./PowerEntity');

var _PowerEntity2 = _interopRequireDefault(_PowerEntity);

var _helper = require('./helper/helper');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Apiface = function () {
    function Apiface() {
        var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        var adapter = _ref.adapter;

        _classCallCheck(this, Apiface);

        //this.defaultAdapter = adapter;
        this.setDefaultAdapter(adapter);

        this.entityContainer = new _EntityContainer2.default({ entityFactory: new _EntityFactory2.default() });

        this.entityController = new _EntityController2.default({ adapter: this.getDefaultAdapter() });
        this.eventManager = new _EventManager2.default();
    }

    _createClass(Apiface, [{
        key: 'setDefaultAdapter',
        value: function setDefaultAdapter(adapter) {
            return this.defaultAdapter = adapter;
        }
    }, {
        key: 'getDefaultAdapter',
        value: function getDefaultAdapter() {
            return this.defaultAdapter;
        }
    }, {
        key: 'setAdapter',
        value: function setAdapter(adapter) {
            this.setDefaultAdapter(adapter);

            this.entityController.setAdapter(this.getDefaultAdapter());
        }
    }, {
        key: 'getEntityContainer',
        value: function getEntityContainer() {
            return this.entityContainer;
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
        key: 'makePowerEntity',
        value: function makePowerEntity(_ref2) {
            var entity = _ref2.entity;
            var customAdapter = _ref2.customAdapter;

            return new _PowerEntity2.default({
                entity: entity,
                customAdapter: customAdapter,
                entityController: this.getEntityController(),
                eventManager: this.getEventManager()
            });
        }
    }, {
        key: 'getPowerEntity',
        value: function getPowerEntity(_ref3) {
            var name = _ref3.name;
            var uri = _ref3.uri;
            var fixedParams = _ref3.fixedParams;
            var entityClass = _ref3.entityClass;
            var customAdapter = _ref3.customAdapter;
            var _ref3$overwrite = _ref3.overwrite;
            var overwrite = _ref3$overwrite === undefined ? false : _ref3$overwrite;

            var entityContainer = this.getEntityContainer();

            var entity = null;
            if (overwrite) {
                entity = entityContainer.setEntity({ name: name, uri: uri, fixedParams: fixedParams, entityClass: entityClass });
            } else {
                entity = entityContainer.getEntityByName(name) || entityContainer.setEntity({ name: name, uri: uri, fixedParams: fixedParams, entityClass: entityClass });
            }

            if (!entity) return null;

            if (uri) entity.setUri(uri);
            if (fixedParams) entity.setFixedParams(fixedParams);

            return this.makePowerEntity({ entity: entity, customAdapter: customAdapter });
        }
    }, {
        key: 'on',
        value: function on() {
            var _this = this,
                _arguments = arguments;

            var eventName = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
            var callback = arguments.length <= 1 || arguments[1] === undefined ? function () {} : arguments[1];

            if (!eventName) {
                return false;
            }

            var promise = (0, _helper.promiseFactory)();

            this.getEventManager().addEventListener(eventName, function (response) {
                if (response && response.error) {
                    promise.reject.apply(_this, _arguments);
                } else {
                    promise.resolve.apply(_this, _arguments);
                }

                callback.apply(_this, _arguments);
            });

            return promise.await;
        }
    }]);

    return Apiface;
}();

exports.default = Apiface;