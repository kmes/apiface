import AbstractHttpAdapter from './abstract/AbstractHttpAdapter';

export default class FormDataAdapter extends AbstractHttpAdapter {
    constructor( config ) {
        super( config );
    }

    createData( data = {} ) {
        return this.httpCall( 'post', this.makeFormData(data), { headers: {'Content-Type': 'multipart/form-data'} } );
    }
    readData( params = {} ) {
        return this.httpCall( 'get', this.makeFormData(params), { headers: {'Content-Type': 'multipart/form-data'} } );
    }
    updateData( data = {} ) {
        return this.httpCall( 'post', this.makeFormData(data), { headers: {'Content-Type': 'multipart/form-data'} } );
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