'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EntityContainer = function () {
    function EntityContainer(_ref) {
        var entityFactory = _ref.entityFactory;

        _classCallCheck(this, EntityContainer);

        if (!entityFactory || typeof entityFactory.make !== 'function') {
            throw new Error('entityFactory params don\'t implements EntityFactory interface');
        }
        this.entityFactory = entityFactory;

        this.entities = {};
    }

    _createClass(EntityContainer, [{
        key: 'setEntity',
        value: function setEntity(_ref2) {
            var uri = _ref2.uri;
            var name = _ref2.name;
            var fixedParams = _ref2.fixedParams;
            var entityClass = _ref2.entityClass;

            var entity = this.entityFactory.make({
                uri: uri,
                name: name,
                fixedParams: fixedParams,
                entityClass: entityClass
            });

            if (!entity || !entity.name) {
                throw new Error('entityFactory.make don\'t return a valid implementation of BaseEntity interface');
                //return null;
            }

            return this.entities[entity.name] = entity;
        }
    }, {
        key: 'getEntityByName',
        value: function getEntityByName(name) {
            if (!name || typeof name !== 'string') return false;

            return this.entities[name] || null;
        }
    }, {
        key: 'getEntityByUri',
        value: function getEntityByUri(uri) {
            if (!uri || typeof uri !== 'string') return false;

            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = this.entities[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var entity = _step.value;

                    if (entity.getUri() == uri) return entity;
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

            return null;
        }
    }]);

    return EntityContainer;
}();

exports.default = EntityContainer;