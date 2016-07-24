export default class EntityController {
    constructor({ adapter }) {
        //this.adapter = adapter;
        this.setAdapter( adapter );
    }

    getAdapter({ uri, params = {}, adapter = null }) {
        if( !adapter ) adapter = this.adapter;

        adapter.setUri( uri );
        adapter.resetResults();

        return adapter;
    }

    setAdapter( adapter ) {
        return this.adapter = adapter;
    }

    createData({ uri, params = {}, adapter = null, checkIfExist = false }) {
        return this.getAdapter({ uri, params, adapter }).createData( params, checkIfExist );
    } //return Promise

    readData({ uri, params = {}, data = {}, adapter = null }) {
        return this.getAdapter({ uri, params, adapter }).readData( params );
    } //return Promise

    updateData({ uri, params = {}, data = {}, adapter = null, oldData = null }) {
        return this.getAdapter({ uri, params, adapter }).updateData( data, oldData );
    } //return Promise

    deleteData({ uri, params = {}, data = {}, adapter = null }) {
        return this.getAdapter({ uri, params, adapter }).deleteData( data );
    } //return Promise

    pushData({ uri, params = {}, data = {}, adapter = null }) {
        return this.getAdapter({ uri, params, adapter }).pushData( data );
    } //return Promise

    onChangeData({ uri, params = {}, data = {}, adapter = null, callback = () => {} }) {
        return this.getAdapter({ uri, params, adapter }).onChangeData( callback );
    } //return Promise

}