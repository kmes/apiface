import AbstractAdapter from './AbstractAdapter';

import axios from 'axios';

export default class AbstractHttpAdapter extends AbstractAdapter {
    constructor({ url }) {
        super({ url });
    }

    httpCall( method, params ) {
        var promise = this.getPromise();

        console.log('httpCall', arguments);

        axios[ method ]( this.getUrl(), { params: params } )
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