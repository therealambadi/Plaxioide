#include "generated.hpp"
#include <stdint.h>

extern "C" int64_t strucpp_get_current_time(void);

namespace strucpp {
TON::TON() {}

void TON::operator()() {
    const IEC_TIME now = IEC_TIME(static_cast<TIME_t>(strucpp_get_current_time()));
    CURRENT_TIME = now;
    if (((((STATE == 0)) & (NOT(PREV_IN))) & (IN))) {
        STATE = 1; Q = false; START_TIME = CURRENT_TIME;
    } else {
        if ((NOT(IN))) { ET = 0LL; Q = false; STATE = 0; }
        else if ((STATE == 1)) {
            if (((START_TIME + PT) <= CURRENT_TIME)) { STATE = 2; Q = true; ET = PT; }
            else { ET = CURRENT_TIME - START_TIME; }
        }
    }
    PREV_IN = IN;
}
}
