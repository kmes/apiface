'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.promiseFactory = promiseFactory;
exports.getEventsName = getEventsName;
exports.getCurrentPosition = getCurrentPosition;

var _constants = require('../config/constants');

function promiseFactory() {
    var _resolve = null;
    var _reject = null;
    var promise = new Promise(function (resolve, reject) {
        _resolve = resolve;
        _reject = reject;
    });

    return {
        resolve: _resolve,
        reject: _reject,
        await: promise
    };
}

function getEventsName(_ref) {
    var method = _ref.method;
    var dataStatus = _ref.dataStatus;

    var prefix = method;

    if (method == 'fetch') {
        prefix = 'read';
    } else if (method == 'save') {
        switch (dataStatus) {
            case _constants.DATA_STATUS.busy:
                return { error: 'busy' };
                break;
            case _constants.DATA_STATUS.pending:
                return { error: 'void_data' };
                break;
            case _constants.DATA_STATUS.synced:
                prefix = 'read';
                break;
            case _constants.DATA_STATUS.created:
                prefix = 'create';
                break;
            case _constants.DATA_STATUS.modified:
                prefix = 'update';
                break;
            default:

                break;
        }
    } else if (method == 'sync') {
        prefix = 'sync';
    }

    return {
        request: prefix + '_request',
        success: prefix + '_success',
        error: prefix + '_error'
    };
}

function getCurrentPosition(callback) {
    if (!callback) callback = function callback() {};

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
            callback({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            });
        }, function (error) {
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    alert('Permessi per la Geolocalizzazione non attivi. Per favore attivali in Impostazioni > Generali > Ripristina posizione e privacy.');
                    break;
                case error.POSITION_UNAVAILABLE:
                    alert('Posizione utente non disponibile. Prova ad attivare il wi-fi o riprova più tardi.');
                    break;
                case error.TIMEOUT:
                    alert('La richiesta per la posizione è scaduta. Riprova più tardi.');
                    break;
                case error.UNKNOWN_ERROR:
                    alert('Sì è verificato un errore. Riprova più tardi.');
                    break;
                default:
                    alert('Sì è verificato un errore. Riprova più tardi.');
            }

            callback(false);
        });
    }
}