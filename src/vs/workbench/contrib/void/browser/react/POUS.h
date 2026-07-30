#ifndef __POUS_H
#define __POUS_H

#include "accessor.h"
#include "iec_std_lib.h"

// PROGRAM PROG0
// Data part
typedef struct {
  // PROGRAM Interface - IN, OUT, IN_OUT variables

  // PROGRAM private variables - TEMP, private and located variables
  __DECLARE_VAR(BOOL,PB_START)
  __DECLARE_VAR(BOOL,PB_STOP)
  __DECLARE_VAR(BOOL,OVERLOAD)
  __DECLARE_VAR(BOOL,MOTOR_RUN)
  __DECLARE_VAR(BOOL,FAULT_RESET)
  __DECLARE_VAR(BOOL,RUN_TIMEOUT)
  __DECLARE_VAR(TIME,T_10S)
  __DECLARE_VAR(BOOL,RESET_ALL)
  __DECLARE_VAR(BOOL,MOTOR_ON)
  __DECLARE_VAR(BOOL,START_TMR)
  __DECLARE_VAR(BOOL,MOTOR_OFF)
  __DECLARE_VAR(BOOL,TIMEOUT)
  TON RUN_TMR;
  __DECLARE_VAR(INT,_SFC_STATE)

} PROG0;

void PROG0_init__(PROG0 *data__, BOOL retain);
// Code part
void PROG0_body__(PROG0 *data__);
#endif //__POUS_H
