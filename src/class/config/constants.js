export const DATA_STATUS = {
    busy: 0,
    pending: 1,
    created: 2,
    modified: 3,
    added: 4,
    synced: 5,
    error: 6
};

export const EVENT_TYPE = {
    create_request:   'create_request',
    create_success:   'create_success',
    create_error:     'create_error',

    read_request:     'read_request',
    read_success:     'read_success',
    read_error:       'read_error',

    update_request:   'update_request',
    update_success:   'update_success',
    update_error:     'update_error',

    delete_request:   'delete_request',
    delete_success:   'delete_success',
    delete_error:     'delete_error',

    add_request:      'add_request',
    add_success:      'add_success',
    add_error:        'add_error'
};