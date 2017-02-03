import AbstractAdapter from './AbstractAdapter';

import axios from 'axios';

export default class AbstractHttpAdapter extends AbstractAdapter {
    constructor({ url }) {
        super({ url });
    }

    httpCall( method, params, config = {} ) {
        let promise = this.getPromise();

        console.log('httpCall', arguments);

        let newParams = null;
        if( params instanceof FormData && method != 'get' ) {
            newParams = params;
            for( let name in this.getParams() ) {
                let value = this.getParams()[name];
                newParams.append( name, value );
            }
        }
        else {
            newParams = { ...this.getParams(), ...params };
        }

        let data = {};
        if( method == 'get') {
            data = {
                params: newParams
            };
        }
        else {
            data = newParams;
        }

        axios[ method ]( this.getUrl(), data, config )
            .then(function( resp ) {
                console.log('then', resp);
                if( resp.status == 200 ) {
                    console.log('resolve');
                    promise.resolve({ response: resp, data: resp.data });
                }
                else {
                    promise.reject({ response: resp, data: resp.data });
                }
            })
            .catch(function( err ) {
                console.log('catch', err);
                promise.reject({ response: err });
            });

        return promise.await;
    }

}