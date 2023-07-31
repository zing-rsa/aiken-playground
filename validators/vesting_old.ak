use aiken/hash.{Blake2b_224, Hash}
use aiken/interval.{Finite}
use aiken/transaction.{
  ScriptContext, Spend, Transaction, ValidityRange,
} as tx
use aiken/transaction/credential.{VerificationKey}
use aiken/list

type POSIXTime =
  Int

type PubKeyHash =
  Hash<Blake2b_224, VerificationKey>

type VestingDatum {
  deadline: POSIXTime,
  beneficiary: PubKeyHash
}

validator {
  fn spend(dtm: VestingDatum, _rdm: Void, ctx: ScriptContext) {
    when ctx.purpose is {
      Spend(_) ->
        signedByBeneficiary(dtm.beneficiary, ctx.transaction) && deadlinePassed(dtm.deadline, ctx.transaction.validity_range)
      _ -> False
    }
  }
}

fn deadlinePassed(deadline: POSIXTime, range: ValidityRange) -> Bool {
  when range.lower_bound.bound_type is {
    Finite(now) -> now >= deadline
    _ -> False
  }
}

fn signedByBeneficiary(ben: PubKeyHash, tx: Transaction) {
  list.has(tx.extra_signatories, ben)
}
