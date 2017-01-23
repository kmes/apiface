'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _AbstractAdapter2 = require('./abstract/AbstractAdapter');

var _AbstractAdapter3 = _interopRequireDefault(_AbstractAdapter2);

var _firebase = require('firebase');

var _firebase2 = _interopRequireDefault(_firebase);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var FirebaseAdapter = function (_AbstractAdapter) {
    _inherits(FirebaseAdapter, _AbstractAdapter);

    function FirebaseAdapter(_ref) {
        var _ref$url = _ref.url,
            url = _ref$url === undefined ? '' : _ref$url;

        _classCallCheck(this, FirebaseAdapter);

        var _this = _possibleConstructorReturn(this, (FirebaseAdapter.__proto__ || Object.getPrototypeOf(FirebaseAdapter)).call(this, { url: url }));

        _this.fb = new _firebase2.default(_this.getUrl());
        return _this;
    }

    _createClass(FirebaseAdapter, [{
        key: 'getUriRef',
        value: function getUriRef() {
            var uri = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.getUri();

            return this.fb.child(uri);
        }
    }, {
        key: 'createData',
        value: function createData(data) {
            var checkIfExist = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

            var promise = this.getPromise();

            var uriRef = this.getUriRef();

            if (checkIfExist) {
                uriRef.transaction(function (currentData) {
                    if (!currentData || currentData === {} || currentData === []) {
                        promise.reject({ currentData: currentData });
                    } else {
                        return data;
                    }
                }).then(function (response) {
                    return promise.resolve({ data: data, response: response || data });
                }).catch(function (error) {
                    return promise.reject({ response: error });
                });
            } else {
                uriRef.set(data).then(function (response) {
                    return promise.resolve({ data: data, response: response || data });
                }).catch(function (error) {
                    return promise.reject({ response: error });
                });
            }

            return promise.await;
        }
    }, {
        key: 'readData',
        value: function readData(params) {
            var promise = this.getPromise();

            var uriRef = this.getUriRef();
            uriRef.once('value', function (snap) {
                return promise.resolve({ data: snap.val(), response: snap });
            }, function (error) {
                return promise.reject({ response: error });
            });

            return promise.await;
        }
    }, {
        key: 'updateData',
        value: function updateData(data) {
            var oldData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

            var promise = this.getPromise();

            var uriRef = this.getUriRef();

            if (oldData) {
                uriRef.transaction(function (currentData) {
                    if (JSON.stringify(currentData) != JSON.stringify(oldData)) {
                        promise.reject({ currentData: currentData });
                    } else {
                        return data;
                    }
                }).then(function (response) {
                    return promise.resolve({ data: data, response: response || data });
                }).catch(function (error) {
                    return promise.reject({ response: error });
                });
            } else {
                uriRef.update(data).then(function (response) {
                    return promise.resolve({ data: data, response: response || data });
                }).catch(function (error) {
                    return promise.reject({ response: error });
                });
            }

            return promise.await;
        }
    }, {
        key: 'deleteData',
        value: function deleteData(params) {
            var promise = this.getPromise();

            var uriRef = this.getUriRef();
            uriRef.remove().then(function () {
                return promise.resolve({ data: params, response: params });
            }).catch(function (error) {
                return promise.reject({ response: error });
            });

            return promise.await;
        }
    }, {
        key: 'pushData',
        value: function pushData(data) {
            var promise = this.getPromise();

            var uriRef = this.getUriRef();

            var _fnPushed = function (_ref2) {
                var node = _ref2.node,
                    id = _ref2.id,
                    error = _ref2.error;

                this.afterPush({ node: node, id: id, error: error });

                if (!this.results.pendingToPush.length) {

                    if (!this.results.notPushed.length) {
                        promise.resolve({ data: data, response: this.results });
                    } else {
                        promise.reject({ response: this.results });
                    }
                }
            }.bind(this);

            var nodes = data && typeof data.length !== 'undefined' ? data : [data];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                var _loop = function _loop() {
                    var node = _step.value;

                    var nodeRef = uriRef.push(node);
                    nodeRef.then(function () {
                        return _fnPushed({ node: node, id: nodeRef.key() });
                    }).catch(function (error) {
                        return _fnPushed({ node: node, id: nodeRef.key(), error: error || true });
                    });
                };

                for (var _iterator = nodes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    _loop();
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

            return promise.await;
        }
    }, {
        key: 'onChangeData',
        value: function onChangeData() {
            var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

            var promise = this.getPromise();

            var uriRef = this.getUriRef();
            uriRef.once('value', function (snap) {
                var oldSnap = snap;

                uriRef.on('value', function (newSnap) {
                    callback({ data: newSnap.val(), response: newSnap }, { data: oldSnap.val(), response: oldSnap });
                    promise.resolve({ data: newSnap.val(), response: newSnap }, { data: oldSnap.val(), response: oldSnap });

                    oldSnap = newSnap;
                }, function (error) {
                    promise.reject({ response: error });
                });
            }, function (error) {
                promise.reject({ response: error });
            });

            return promise.await;
        }
    }]);

    return FirebaseAdapter;
}(_AbstractAdapter3.default);

exports.default = FirebaseAdapter;