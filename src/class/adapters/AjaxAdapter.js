import AbstractHttpAdapter from './abstract/AbstractHttpAdapter';

export default class AjaxAdapter extends AbstractHttpAdapter {
    constructor({ url }) {
        super({ url });
    }

    createData( data = {} ) {
        return this.httpCall( 'post', data );
    }
    readData( params = {} ) {
        return this.httpCall( 'get', params );
    }
    updateData( data = {} ) {
        return this.httpCall( 'post', data );
    }

    /*pushData( params = {} ) {
     return this.ajaxCall( 'post', params );
     }*/
}