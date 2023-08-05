
fn oneOnly(ls: List<Int>) -> Bool {
  when ls is {
    [_] -> True
    _   -> False
  }
}

!test testthree() {
  oneOnly([1,2,3])
}

test testone() {
  oneOnly([1])
}

!test testtwo() {
  oneOnly([1,2])
}
