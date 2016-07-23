'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _constants = require('./config/constants');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EventManager = function () {
    function EventManager() {
        _classCallCheck(this, EventManager);

        var eventsName = Object.keys(_constants.EVENT_TYPE);

        this.listeners = {};
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = eventsName[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var name = _step.value;

                this.listeners[name] = [{
                    priority: 0,
                    handler: function handler() {}
                }];
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

    _createClass(EventManager, [{
        key: 'addEventListener',
        value: function addEventListener(evtName, callback) {
            var priority = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

            var errorMsg = '';
            if (!evtName || typeof evtName !== 'string') errorMsg = 'Event\'s name is not defined.';
            if (typeof callback !== 'function') errorMsg = 'Callback is not defined';
            if (!this.listeners[evtName]) errorMsg = 'Event\'s name is not valid.';

            if (errorMsg) {
                throw new Error(errorMsg);
                //return false;
            }

            var truePriority = this.getTruePriority(evtName, priority);

            this.listeners[evtName].push({
                priority: truePriority,
                handler: callback
            });

            this.sortListener();

            return truePriority;
        }
    }, {
        key: 'getTruePriority',
        value: function getTruePriority(evtName) {
            var priority = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

            if (!this.listeners[evtName]) return false;

            var priorityList = Object.keys(this.listeners[evtName]).sort();
            if (!+priority) {
                return +priorityList.pop() + 1;
            }

            var truePriority = +priority;
            for (var i in priorityList) {
                if (truePriority == i) {
                    truePriority++;
                } else if (truePriority < i) {
                    break;
                }
            }

            return truePriority;
        }
    }, {
        key: 'sortListener',
        value: function sortListener() {
            for (var eventName in this.listeners) {
                this.listeners[eventName].sort(function (a, b) {
                    if (a.priority > b.priority) {
                        return -1;
                    } else {
                        return 1;
                    }
                });
            }

            return this.listeners;
        }
    }, {
        key: 'trigger',
        value: function trigger(evtName) {
            var data = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

            if (!this.listeners[evtName]) return false;

            this.listeners[evtName].map(function (listener) {
                listener.handler.call(this, {
                    name: evtName,
                    priority: listener.priority,
                    data: data,
                    dt: new Date().getTime(),
                    handler: listener.handler
                });
            });
        }
    }]);

    return EventManager;
}();

exports.default = EventManager;