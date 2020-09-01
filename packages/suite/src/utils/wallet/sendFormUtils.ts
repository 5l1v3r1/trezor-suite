import BigNumber from 'bignumber.js';
import { FieldError, UseFormMethods } from 'react-hook-form';
import { EthereumTransaction, FeeLevel, ComposeOutput } from 'trezor-connect';
import Common from 'ethereumjs-common';
import { Transaction, TxData } from 'ethereumjs-tx';
import { fromWei, padLeft, toHex, toWei } from 'web3-utils';

import { ERC20_GAS_LIMIT, ERC20_TRANSFER } from '@wallet-constants/sendForm';
import {
    amountToSatoshi,
    networkAmountToSatoshi,
    formatNetworkAmount,
} from '@wallet-utils/accountUtils';
import { Network, Account, CoinFiatRates } from '@wallet-types';
import { FormState, FeeInfo, EthTransactionData } from '@wallet-types/sendForm';

export const calculateTotal = (amount: string, fee: string): string => {
    try {
        const bAmount = new BigNumber(amount);
        if (bAmount.isNaN()) {
            console.error('Amount is not a number');
        }
        return bAmount.plus(fee).toString();
    } catch (error) {
        return '0';
    }
};

export const calculateMax = (availableBalance: string, fee: string): string => {
    try {
        const balanceBig = new BigNumber(availableBalance);
        const max = balanceBig.minus(fee);
        if (max.isLessThan(0)) return '0';
        return max.toFixed();
    } catch (error) {
        return '0';
    }
};

export const getFee = (
    transactionInfo: any,
    networkType: Account['networkType'],
    symbol: Account['symbol'],
) => {
    if (networkType === 'ethereum') {
        const gasPriceInWei = toWei(transactionInfo.feePerUnit, 'gwei');
        return fromWei(gasPriceInWei, 'ether');
    }

    return formatNetworkAmount(transactionInfo.fee, symbol);
};

// ETH SPECIFIC

const padLeftEven = (hex: string): string => (hex.length % 2 !== 0 ? `0${hex}` : hex);

export const sanitizeHex = ($hex: string): string => {
    const hex = $hex.toLowerCase().substring(0, 2) === '0x' ? $hex.substring(2) : $hex;
    if (hex === '') return '';
    return `0x${padLeftEven(hex)}`;
};

/*
    Calculate fee from gas price and gas limit
 */
export const calculateEthFee = (gasPrice?: string, gasLimit?: string): string => {
    if (!gasPrice || !gasLimit) {
        return '0';
    }
    try {
        const result = new BigNumber(gasPrice).times(gasLimit);
        if (result.isNaN()) throw new Error('NaN');
        return result.toFixed();
    } catch (error) {
        return '0';
    }
};

export const prepareEthereumTransaction = (txInfo: EthTransactionData) => {
    const result: EthereumTransaction = {
        to: txInfo.to,
        value: toHex(toWei(txInfo.amount, 'ether')),
        chainId: txInfo.chainId,
        nonce: toHex(txInfo.nonce),
        gasLimit: toHex(txInfo.gasLimit),
        gasPrice: toHex(toWei(txInfo.gasPrice, 'gwei')),
    };

    if (!txInfo.token && txInfo.data) {
        result.data = sanitizeHex(txInfo.data);
    }

    // Build erc20 'transfer' method
    if (txInfo.token) {
        // 32 bytes address parameter, remove '0x' prefix
        const erc20recipient = padLeft(txInfo.to, 64).substring(2);
        // convert amount to satoshi
        const tokenAmount = amountToSatoshi(txInfo.amount, txInfo.token.decimals);
        // 32 bytes amount paramter, remove '0x' prefix
        const erc20amount = padLeft(toHex(tokenAmount), 64).substring(2);
        // join data
        result.data = `0x${ERC20_TRANSFER}${erc20recipient}${erc20amount}`;
        // replace tx recipient to smart contract address
        result.to = txInfo.token.address;
        // replace tx value
        result.value = '0x00';
    }

    return result;
};

export const serializeEthereumTx = (tx: TxData & EthereumTransaction) => {
    // ethereumjs-tx doesn't support ETC (chain 61) by default
    // and it needs to be declared as custom chain
    // see: https://github.com/ethereumjs/ethereumjs-tx/blob/master/examples/custom-chain-tx.ts
    const options =
        tx.chainId === 61
            ? {
                  common: Common.forCustomChain(
                      'mainnet',
                      {
                          name: 'ethereum-classic',
                          networkId: 1,
                          chainId: 61,
                      },
                      'petersburg',
                  ),
              }
            : {
                  chain: tx.chainId,
              };

    const ethTx = new Transaction(tx, options);
    return `0x${ethTx.serialize().toString('hex')}`;
};

export const getFeeLevels = (
    networkType: Network['networkType'],
    feeInfo: FeeInfo,
    token = false,
) => {
    const convertedEthLevels: FeeLevel[] = [];
    const initialLevels: FeeLevel[] = feeInfo.levels.concat({
        label: 'custom',
        feePerUnit: '0',
        blocks: -1,
    });

    if (networkType === 'ethereum') {
        initialLevels.forEach(level =>
            convertedEthLevels.push({
                ...level,
                feePerUnit: fromWei(level.feePerUnit, 'gwei'),
                feeLimit: token ? ERC20_GAS_LIMIT : level.feeLimit,
                feePerTx: token
                    ? new BigNumber(ERC20_GAS_LIMIT).times(level.feePerUnit).toString()
                    : level.feePerTx,
            }),
        );
    }

    return networkType === 'ethereum' ? convertedEthLevels : initialLevels;
};

export const getInputState = (error?: FieldError, value?: string) => {
    if (error) {
        return 'error';
    }

    if (value && value.length > 0 && !error) {
        return 'success';
    }
};

export const getFiatRate = (fiatRates: CoinFiatRates | undefined, currency: string) => {
    if (!fiatRates || !fiatRates.current || !fiatRates.current.rates) return;
    return fiatRates.current.rates[currency];
};

export const buildCurrencyOption = (currency: string) => {
    return { value: currency, label: currency.toUpperCase() };
};

export const buildFeeOptions = (levels: FeeLevel[]) => {
    interface Item {
        label: FeeLevel['label'];
        value: FeeLevel['label'];
    }
    const result: Item[] = [];

    levels.forEach(level => {
        const { label } = level;
        result.push({ label, value: label });
    });

    return result;
};

export const getFeeUnits = (networkType: Network['networkType']) => {
    if (networkType === 'ethereum') return 'GWEI';
    if (networkType === 'ripple') return 'Drops';
    return 'sat/B';
};

// Find all errors with type='compose' in FormState errors
export const findComposeErrors = (errors: UseFormMethods['errors'], prefix?: string) => {
    const composeErrors: string[] = [];
    if (!errors || typeof errors !== 'object') return composeErrors;
    Object.keys(errors).forEach(key => {
        const val = errors[key];
        if (val) {
            if (Array.isArray(val)) {
                // outputs
                val.forEach((output, index) =>
                    composeErrors.push(...findComposeErrors(output, `outputs[${index}]`)),
                );
            } else if (
                typeof val === 'object' &&
                Object.prototype.hasOwnProperty.call(val, 'type') &&
                val.type === 'compose'
            ) {
                // regular top level field
                composeErrors.push(prefix ? `${prefix}.${key}` : key);
            }
        }
    });
    return composeErrors;
};

export const findValidOutputs = (values: Partial<FormState>) => {
    if (!values || !Array.isArray(values.outputs)) return [];
    return values.outputs.filter(
        (output, index) =>
            output &&
            ((output.type === 'payment' &&
                typeof output.amount === 'string' &&
                (values.setMaxOutputId === index || output.amount.length > 0)) ||
                (output.type === 'opreturn' &&
                    typeof output.dataHex === 'string' &&
                    output.dataHex.length > 0)),
    );
};

// type SimpleOutput = Exclude<ComposeOutput, { type: 'opreturn' } | { address_n: number[] }>;

export const getBitcoinComposeOutputs = (values: Partial<FormState>) => {
    const result: ComposeOutput[] = [];
    if (!values || !Array.isArray(values.outputs)) return result;

    values.outputs.forEach((output, index) => {
        if (output.type === 'opreturn' && output.dataHex) {
            result.push({
                type: 'opreturn',
                dataHex: output.dataHex,
            });
        }

        const { address } = output;
        const isMaxActive = values.setMaxOutputId === index;
        if (isMaxActive) {
            if (address) {
                result.push({
                    type: 'send-max',
                    address,
                });
            } else {
                result.push({ type: 'send-max-noaddress' });
            }
        } else if (output.amount) {
            const amount = networkAmountToSatoshi(output.amount, 'btc');
            if (address) {
                result.push({
                    type: 'external',
                    address,
                    amount,
                });
            } else {
                result.push({
                    type: 'noaddress',
                    amount,
                });
            }
        }
    });

    // corner case for multiple outputs
    // one Output is valid and "final" but other has only address
    // to prevent composing "final" transaction switch it to not-final (noaddress)
    const hasIncompleteOutput = values.outputs.find(o => o.address && !o.amount);
    if (hasIncompleteOutput) {
        const finalOutput = result.find(o => o.type === 'send-max' || o.type === 'external');
        if (finalOutput) {
            // replace to noaddress
            finalOutput.type = finalOutput.type === 'external' ? 'noaddress' : 'send-max-noaddress';
        }
    }

    return result;
};

export const buildTokenOptions = (account: Account) => {
    interface Option {
        label: string;
        value: string | null;
    }

    const result: Option[] = [
        {
            value: null,
            label: account.symbol.toUpperCase(),
        },
    ];

    if (account.tokens) {
        account.tokens.forEach(token => {
            const tokenName = token.symbol || 'N/A';
            result.push({
                value: token.address,
                label: tokenName.toUpperCase(),
            });
        });
    }

    return result;
};

export const findToken = (tokens: Account['tokens'], address?: string | null) => {
    if (!address || !tokens) return;
    return tokens.find(t => t.address === address);
};
