use aiken/transaction/credential.{VerificationKey, from_verification_key, Address }
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
    InlineDatum,
    Spend,
    find_input
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
        expect Spend(outRef) = ctx.purpose
        expect Some(ownInput) = find_input(ctx.transaction.inputs, outRef)
        
        isSeller(ctx.transaction.extra_signatories, dtm.seller) || (
            paysSeller(ctx.transaction.outputs, dtm) && 
            spendsOne(ctx.transaction.inputs, ownInput.output.address)
       ) 
    }
}

fn isSeller(signatories: List<PubKeyHash>, seller: PubKeyHash) {
    list.has(signatories, seller)
}

fn paysSeller(outputs: List<Output>, dtm: Datum) {
    list.any(outputs, fn (o) {
        o.address == from_verification_key(dtm.seller) &&
        o.value == from_lovelace(1_000_000 * dtm.price)
    })
} 

// required to prevent a double spend vulnerability if the same seller lists 2 tokens for the same price
fn spendsOne(inputs: List<Input>, address: Address ) {
    list.count(inputs, fn (i) { i.output.address == address }) == 1 
}

//-------------------------------------------------------------------------------------------------
// Contract Tests
//-------------------------------------------------------------------------------------------------

fn simulate(
    signatories: List<PubKeyHash>,
    outputs: List<Output>,
    inputs: List<Input>,
    dtm: Datum
    ) -> Bool {

        isSeller(signatories, dtm.seller) || (
            paysSeller(outputs, dtm) && 
            spendsOne(inputs, from_verification_key("aaaa")) // script address for testing will be aaaa
        )
}

// valid test
test case1 () {

    let dtm = Datum { 
        price: 100,
        seller: "asdf"   
    }
    
    let inputs = [
          Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "sdff" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("aaaa"),
                value: from_lovelace(1_000_000),
                datum: InlineDatum(dtm),
                reference_script: None
            }
        }
    ]

    let outputs = [
        Output {
            address: from_verification_key("asdf"),
            value: from_lovelace(100_000_000),
            datum: NoDatum,
            reference_script: None
        },
        Output {
            address: from_verification_key("ffff"),
            value: from_lovelace(1_000_000), //token
            datum: NoDatum,
            reference_script: None
        }
    ] 

    if simulate([], outputs, inputs, dtm) {
        True
    } else {
        error
    }
}

// underpay the seller
!test case2 () {

    let dtm = Datum { 
        price: 100,
        seller: "asdf"   
    }
    
    let inputs = [
          Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "sdff" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("aaaa"),
                value: from_lovelace(1_000_000),
                datum: InlineDatum(dtm),
                reference_script: None
            }
        }
    ]

    let outputs = [
        Output {
            address: from_verification_key("asdf"),
            value: from_lovelace(10_000_000),
            datum: NoDatum,
            reference_script: None
        }
    ] 

    if simulate([], outputs, inputs, dtm) {
        True
    } else {
        error
    }
}

// don't pay the seller
!test case3 () {

    let dtm = Datum { 
        price: 100,
        seller: "asdf"   
    }
    
    let inputs = [
          Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "sdff" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("aaaa"),
                value: from_lovelace(1_000_000),
                datum: InlineDatum(dtm),
                reference_script: None
            }
        }
    ]

    let outputs = [
        Output {
            address: from_verification_key("asff"),
            value: from_lovelace(100_000_000),
            datum: NoDatum,
            reference_script: None
        }
    ] 

    if simulate([], outputs, inputs, dtm) {
        True
    } else {
        error
    }
}

// Pay the seller, but claim 2 of his tokens
!test case4 () {

    let dtm = Datum { 
        price: 100,
        seller: "asdf"   
    }
    
    let inputs = [
          Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "sdff" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("aaaa"),
                value: from_lovelace(1_000_000),
                datum: InlineDatum(dtm),
                reference_script: None
            }
        },
        Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "sdff" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("aaaa"),
                value: from_lovelace(1_000_000),
                datum: InlineDatum(dtm),
                reference_script: None
            }
        }
    ]

    let outputs = [
        Output {
            address: from_verification_key("asdf"),
            value: from_lovelace(100_000_000),
            datum: NoDatum,
            reference_script: None
        }
    ] 

    if simulate([], outputs, inputs, dtm) {
        True
    } else {
        error
    }
}

//-------------------------------------------------------------------------------------------------
// Function Tests
//-------------------------------------------------------------------------------------------------


test spend1() {
    
    let inputs = [
          Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "asdf" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("aaaa"),
                value: from_lovelace(1_000_000),
                datum: NoDatum,
                reference_script: None
            }
        }
    ]

    spendsOne(inputs, from_verification_key("aaaa"))
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
                value: from_lovelace(1_000_000),
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
                value: from_lovelace(1_000_000),
                datum: NoDatum,
                reference_script: None
            }
        }
    ]

    if spendsOne(inputs,from_verification_key("aaaa")) {
        True
    } else {
        error
    }
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

    if paysSeller(outputs, dtm) {
        True
    } else {
        error
    }
}

!test dontPaySeller() {
    let dtm = Datum {
        seller: "asdf",
        price: 100
    }

    if paysSeller([], dtm) {
        True
    } else {
        error
    }
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
 
    if paysSeller(outputs, dtm) {
        True
    } else {
        error
    }
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
 
    if isSeller(signatories, dtm.seller) {
        True
    } else {
        error
    }

}
