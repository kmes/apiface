import AbstractHttpAdapter from './abstract/AbstractHttpAdapter';

export default class AjaxAdapter extends AbstractHttpAdapter {
    constructor( config ) {
        super( config );
    }

    createData( data = {} ) {
        return this.httpCall( 'post', data );
    }
    readData( data = {} ) {
        return this.httpCall( 'get', data );
    }
    updateData( data = {} ) {
        return this.httpCall( 'post', data );
    }

    /*pushData( params = {} ) {
     return this.ajaxCall( 'post', params );
     }*/
}