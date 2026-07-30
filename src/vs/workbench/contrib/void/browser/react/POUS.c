void PROG0_init__(PROG0 *data__, BOOL retain) {
  __INIT_VAR(data__->PB_START,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->PB_STOP,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->OVERLOAD,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->MOTOR_RUN,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->FAULT_RESET,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->RUN_TIMEOUT,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->T_10S,__time_to_timespec(1, 0, 0, 0, 0, 0),retain)
  __INIT_VAR(data__->RESET_ALL,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->MOTOR_ON,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->START_TMR,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->MOTOR_OFF,__BOOL_LITERAL(FALSE),retain)
  __INIT_VAR(data__->TIMEOUT,__BOOL_LITERAL(FALSE),retain)
  TON_init__(&data__->RUN_TMR,retain);
  __INIT_VAR(data__->_SFC_STATE,-1,retain)
}

// Code part
void PROG0_body__(PROG0 *data__) {
  // Initialise TEMP variables

  if ((((__GET_VAR(data__->PB_START,) && !(__GET_VAR(data__->PB_STOP,))) && !(__GET_VAR(data__->OVERLOAD,))) || __GET_VAR(data__->MOTOR_RUN,))) {
    __SET_VAR(data__->,MOTOR_RUN,,__BOOL_LITERAL(TRUE));
  } else {
    __SET_VAR(data__->,MOTOR_RUN,,__BOOL_LITERAL(FALSE));
  };
  if (__GET_VAR(data__->MOTOR_RUN,)) {
    __SET_VAR(data__->RUN_TMR.,EN,,__BOOL_LITERAL(TRUE));
    TON_body__(&data__->RUN_TMR);
  };
  __SET_VAR(data__->,RUN_TIMEOUT,,__GET_VAR(data__->RUN_TMR.Q,));
  if (__GET_VAR(data__->FAULT_RESET,)) {
    __SET_VAR(data__->,RUN_TIMEOUT,,__BOOL_LITERAL(FALSE));
  };
  if ((__GET_VAR(data__->_SFC_STATE,) == -1)) {
    __SET_VAR(data__->,_SFC_STATE,,0);
  };
  {
    INT __case_expression = __GET_VAR(data__->_SFC_STATE,);
    if ((__case_expression == 0)) {
      __SET_VAR(data__->,RESET_ALL,,__BOOL_LITERAL(TRUE));
      if (__GET_VAR(data__->PB_START,)) {
        __SET_VAR(data__->,_SFC_STATE,,1);
      };
    }
    else if ((__case_expression == 1)) {
      __SET_VAR(data__->,MOTOR_ON,,__BOOL_LITERAL(TRUE));
      __SET_VAR(data__->,START_TMR,,__BOOL_LITERAL(TRUE));
      if ((__GET_VAR(data__->PB_STOP,) || __GET_VAR(data__->TIMEOUT,))) {
        __SET_VAR(data__->,_SFC_STATE,,2);
      };
    }
    else if ((__case_expression == 2)) {
      __SET_VAR(data__->,MOTOR_OFF,,__BOOL_LITERAL(TRUE));
      if (__BOOL_LITERAL(TRUE)) {
        __SET_VAR(data__->,_SFC_STATE,,0);
      };
    }
  };

  goto __end;

__end:
  return;
} // PROG0_body__() 





