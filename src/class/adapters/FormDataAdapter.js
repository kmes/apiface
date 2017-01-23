import AbstractHttpAdapter from './abstract/AbstractHttpAdapter';

export default class FormDataAdapter extends AbstractHttpAdapter {
    constructor({ url }) {
        super({ url });
    }

    createData( data = {} ) {
        return this.httpCall( 'post', this.makeFormData(data) );
    }
    readData( params = {} ) {
        return this.httpCall( 'get', this.makeFormData(params) );
    }
    updateData( data = {} ) {
        return this.httpCall( 'post', this.makeFormData(data) );
    }

    makeFormData( data = {} ) {
        let formData = new FormData();

        for( let key in data ) {
            let value = data[key];
            formData.append( key, value );
        }

        return formData;
    }
}