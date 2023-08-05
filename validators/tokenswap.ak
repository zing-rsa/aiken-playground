use aiken/transaction/credential.{VerificationKey, from_verification_key}
use aiken/transaction/value.{from_lovelace}
use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction.{
    ScriptContext,
    OutputReference,
    Output,
    Input,
    NoDatum,
    Redeemer,
    TransactionId,
    InlineDatum
}
use aiken/list
 
type PubKeyHash =
    Hash<Blake2b_224, VerificationKey>

type Datum {
    seller: PubKeyHash,
    price: Int
}

validator() {
    fn spend(dtm: Datum, _rdm: Redeemer, ctx: ScriptContext) {
        isSeller(ctx.transaction.extra_signatories, dtm.seller) || (
            paysSeller(ctx.transaction.outputs, dtm) && 
            spendsOne(ctx.transaction.inputs)
        )
    }
}

fn isSeller(signatories: List<PubKeyHash>, seller: PubKeyHash) {
    list.has(signatories, seller)
}

fn paysSeller(outputs: List<Output>, dtm: Datum) {
    list.any(outputs, fn (o) {
        o.address == from_verification_key(dtm.seller) &&
        o.value == from_lovelace(1000000 * dtm.price)
    })
} 
// required to prevent a double spend vulnerability if the same seller lists 2 tokens for the same price
fn spendsOne(inputs: List<Input>) {
    when inputs is {
        [_] -> True
        _   -> False
    }
}

test spend1() {
    
    let inputs = [
          Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "asdf" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("asdf"),
                value: from_lovelace(1000000),
                datum: NoDatum,
                reference_script: None
            }
        }
    ]
    spendsOne(inputs)
}

!test spend2() {
    let inputs = [
        Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "asdf" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("1234"),
                value: from_lovelace(1000000),
                datum: NoDatum,
                reference_script: None
            }
        },
        Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "1234" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("1234"),
                value: from_lovelace(1000000),
                datum: NoDatum,
                reference_script: None
            }
        }
    ]

    spendsOne(inputs)
}

test paySeller() {
    let dtm = Datum {
        seller: "asdf",
        price: 100
    }

    let outputs = [
        Output {
            address: from_verification_key("asdf"),
            value: from_lovelace(100_000_000),
            datum: InlineDatum(dtm),
            reference_script: None
        }
    ] 
    paysSeller(outputs, dtm)

}

!test underPaySeller() {
    let dtm = Datum {
        seller: "asdf",
        price: 100
    }

    let outputs = [
        Output {
            address: from_verification_key("asdf"),
            value: from_lovelace(10_000_000),
            datum: InlineDatum(dtm),
            reference_script: None
        }
    ] 
    paysSeller(outputs, dtm)
}

!test dontPaySeller() {
    let dtm = Datum {
        seller: "asdf",
        price: 100
    }

    paysSeller([], dtm)
}

!test payOtherSeller() {
    let dtm = Datum {
        seller: "asdf",
        price: 100
    }

    let outputs = [
        Output {
            address: from_verification_key("dsaf"),
            value: from_lovelace(100_000_000),
            datum: InlineDatum(dtm),
            reference_script: None
        }
    ] 
 
    paysSeller(outputs, dtm)
}

test reclaim() {
    let dtm = Datum {
        seller: "asdf",
        price: 100
    }

    let signatories = [
        "asdf"
    ] 
 
    isSeller(signatories, dtm.seller)
}

!test reclaimAsOther() {
    let dtm = Datum {
        seller: "asdf",
        price: 100
    }

    let signatories = [
        "fdsa"
    ] 
 
    isSeller(signatories, dtm.seller)
}
