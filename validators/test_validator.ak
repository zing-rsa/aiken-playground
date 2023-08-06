use aikenplayground/moduletest.{testModuleFunction}
use testlib/testlibmodule.{testlibfunction}

test isTest() {
   testModuleFunction() == "test" 
}

test testlibfunctiontest() {
    testlibfunction() == "testlibfunction"
}
