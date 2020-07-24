import { FakeTransaction } from 'ethereumjs-tx';
import { sha3 } from 'web3-utils';
import * as fixtures from '../__fixtures__/sendFormFixtures';
import {
    prepareEthereumTransaction,
    serializeEthereumTx,
    getInputState,
    calculateTotal,
    calculateMax,
    findComposeErrors,
    findValidOutputs,
} from '../sendFormUtils';

describe('sendForm utils', () => {
    fixtures.prepareEthereumTransaction.forEach(f => {
        it(`prepareEthereumTransaction: ${f.description}`, () => {
            expect(prepareEthereumTransaction(f.txInfo)).toEqual(f.result);
        });
    });

    fixtures.serializeEthereumTx.forEach(f => {
        it(`serializeEthereumTx: ${f.description}`, () => {
            const serialized = serializeEthereumTx(f.tx);
            // verify hash using 2 different tools
            if (f.tx.chainId !== 61) {
                // ETC is not supported
                const tx = new FakeTransaction(serialized);
                const hash1 = tx.hash().toString('hex');
                expect(`0x${hash1}`).toEqual(f.result);
            }
            const hash2 = sha3(serialized);
            expect(hash2).toEqual(f.result);
        });
    });

    it('getInputState', () => {
        expect(getInputState({ address: 'error address' })).toEqual('error');
    });

    it('calculateTotal', () => {
        expect(calculateTotal('1', '2')).toEqual('3');
    });

    it('calculateMax', () => {
        expect(calculateMax('2', '1')).toEqual('1');
    });

    it('findComposeErrors', () => {
        expect(findComposeErrors({})).toEqual([]);
        // @ts-ignore: params
        expect(findComposeErrors(null)).toEqual([]);
        // @ts-ignore: params
        expect(findComposeErrors(true)).toEqual([]);
        // @ts-ignore: params
        expect(findComposeErrors(1)).toEqual([]);
        // @ts-ignore: params
        expect(findComposeErrors('A')).toEqual([]);

        expect(findComposeErrors({ someField: { type: 'validate' } })).toEqual([]);
        expect(findComposeErrors({ someField: { type: 'compose' } })).toEqual(['someField']);
        expect(
            findComposeErrors({
                someField: { type: 'validate' },
                outputs: [
                    { amount: { type: 'compose' }, address: { type: 'validate' } },
                    { amount: { type: 'validate' }, address: { type: 'compose' } },
                ],
                topLevelField: { type: 'compose' },
                invalidFieldNull: null,
                invalidFieldBool: true,
                invalidFieldNumber: 1,
                invalidFieldString: 'A',
                invalidFieldEmpty: {},
                invalidArray: [null, true, 1, 'A', {}],
            }),
        ).toEqual(['outputs[0].amount', 'outputs[1].address', 'topLevelField']);
    });

    it('findValidOutputs', () => {
        // @ts-ignore: params
        expect(findValidOutputs(null)).toEqual([]);
        // @ts-ignore: params
        expect(findValidOutputs(true)).toEqual([]);
        // @ts-ignore: params
        expect(findValidOutputs(1)).toEqual([]);
        // @ts-ignore: params
        expect(findValidOutputs('A')).toEqual([]);

        // @ts-ignore: params
        expect(findValidOutputs({ outputs: [] })).toEqual([]);

        // @ts-ignore: params
        expect(findValidOutputs({ outputs: [null, {}, { amount: '' }, { amount: '1' }] })).toEqual([
            { amount: '1' },
        ]);

        expect(
            findValidOutputs({
                setMaxOutputId: 2,
                // @ts-ignore: params
                outputs: [{ amount: '' }, { amount: '1' }, { amount: '', fiat: '1' }],
            }),
        ).toEqual([{ amount: '1' }, { amount: '', fiat: '1' }]);
    });
});
