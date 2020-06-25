import { MiddlewareAPI } from 'redux';
import * as metadataActions from '@suite-actions/metadataActions';
import { ACCOUNT, DISCOVERY } from '@wallet-actions/constants';
import { AppState, Action, Dispatch } from '@suite-types';

const metadata = (api: MiddlewareAPI<Dispatch, AppState>) => (next: Dispatch) => (
    action: Action,
): Action => {
    if (action.type === ACCOUNT.CREATE) {
        action.payload = api.dispatch(metadataActions.setAccountMetadataKey(action.payload));
    }
    // pass action
    next(action);

    switch (action.type) {
        case DISCOVERY.COMPLETE:
            api.dispatch(metadataActions.fetchMetadata(action.payload.deviceState));
            break;
        default:
        // no default
    }

    return action;
};

export default metadata;