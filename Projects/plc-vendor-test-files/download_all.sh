#!/usr/bin/env bash
# Download publicly available PLC vendor test files from GitHub
set -uo pipefail

BASE="$(cd "$(dirname "$0")" && pwd)"
RAW="https://raw.githubusercontent.com"

FAILED=0

download() {
  local url="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  if curl -fsSL "$url" -o "$dest"; then
    echo "OK  $(basename "$dest")"
  else
    echo "FAIL $(basename "$dest") <- $url" >&2
    rm -f "$dest"
    FAILED=$((FAILED + 1))
  fi
}

echo "=== Siemens TIA Portal (.xml) ==="

# 1 - Simple LAD OB
download "$RAW/kasi09/TIA-Tools/master/examples/xml/Main_OB1.xml" \
  "$BASE/01-siemens-tia-portal/01-simple-lad-ob/Main_OB1.xml"
download "$RAW/factory-x/fx-example/master/templates/plc_TIA/OB1.xml" \
  "$BASE/01-siemens-tia-portal/01-simple-lad-ob/fx-example_OB1.xml"
download "$RAW/mking2203/CodeGeneratorOpenness/master/Sample/LAD_Valve_V0.1.xml" \
  "$BASE/01-siemens-tia-portal/01-simple-lad-ob/LAD_Valve_V0.1.xml"

# 2 - LAD branches + timers
download "$RAW/kasi09/TIA-Tools/master/examples/xml/FB_MotorControl.xml" \
  "$BASE/01-siemens-tia-portal/02-lad-branches-timers/FB_MotorControl.xml"
download "$RAW/mking2203/CodeGeneratorOpenness/master/Sample/LAD_TemplateValve_V0.3.xml" \
  "$BASE/01-siemens-tia-portal/02-lad-branches-timers/LAD_TemplateValve_V0.3.xml"
download "$RAW/mking2203/CodeGeneratorOpenness/master/Sample/plcBlock_LAD_Block_Logic.xml" \
  "$BASE/01-siemens-tia-portal/02-lad-branches-timers/plcBlock_LAD_Block_Logic.xml"
download "$RAW/gabrieleNaso/PLConversionTool/main/datasets/typicals/fc_lad/fc_1.xml" \
  "$BASE/01-siemens-tia-portal/02-lad-branches-timers/fc_lad_1.xml"
download "$RAW/gabrieleNaso/PLConversionTool/main/datasets/typicals/fc_lad/fc_2.xml" \
  "$BASE/01-siemens-tia-portal/02-lad-branches-timers/fc_lad_2.xml"

# 3 - FBD
download "$RAW/DmitryKarpuk/VCITestProject/main/PLC_1/Program%20blocks/Block_1.xml" \
  "$BASE/01-siemens-tia-portal/03-fbd/VCITestProject_Block_1_FBD.xml"
download "$RAW/DmitryKarpuk/VCITestProject/main/PLC_1/Program%20blocks/Block_2.xml" \
  "$BASE/01-siemens-tia-portal/03-fbd/VCITestProject_Block_2_FBD.xml"
download "$RAW/komatic1/testGraphProject/master/PLC_new/Program%20blocks/Conveyor.xml" \
  "$BASE/01-siemens-tia-portal/03-fbd/testGraphProject_Conveyor_FBD.xml"
download "$RAW/dlevine6487/Siemens_PLC_Compare/PLC_Compare/data/PLC_1/Program_blocks/TestEnvironment/TestCallEnv.xml" \
  "$BASE/01-siemens-tia-portal/03-fbd/TestCallEnv_FBD.xml"
download "$RAW/LiamCor/AP_ProjectMechatronica_CoverStation/main/S7-1200%20PLC%20Cover%20Aut1/Program%20blocks/200%20-%20General/FC_EM_General.xml" \
  "$BASE/01-siemens-tia-portal/03-fbd/FC_EM_General_FBD.xml"

# 4 - GRAPH (SFC)
download "$RAW/gabrieleNaso/PLConversionTool/main/datasets/typicals/graph_fb/Type_1.xml" \
  "$BASE/01-siemens-tia-portal/04-graph-sfc/graph_fb_Type_1.xml"
download "$RAW/gabrieleNaso/PLConversionTool/main/datasets/typicals/graph_fb/Type_5.xml" \
  "$BASE/01-siemens-tia-portal/04-graph-sfc/graph_fb_Type_5.xml"
download "$RAW/gabrieleNaso/PLConversionTool/main/datasets/typicals/graph_fb/Type_12.xml" \
  "$BASE/01-siemens-tia-portal/04-graph-sfc/graph_fb_Type_12.xml"
download "$RAW/mking2203/CodeGeneratorOpenness/master/Sample/GraphBranch.xml" \
  "$BASE/01-siemens-tia-portal/04-graph-sfc/GraphBranch.xml"
download "$RAW/mking2203/CodeGeneratorOpenness/master/Sample/GraphBranch2.xml" \
  "$BASE/01-siemens-tia-portal/04-graph-sfc/GraphBranch2.xml"
download "$RAW/komatic1/testGraphProject/master/PLC_1/Program%20blocks/Sequencer.xml" \
  "$BASE/01-siemens-tia-portal/04-graph-sfc/testGraphProject_Sequencer.xml"

# 5 - Mixed complexity FB + DB + types
download "$RAW/kasi09/TIA-Tools/master/examples/xml/DB_Outputs.xml" \
  "$BASE/01-siemens-tia-portal/05-mixed-complexity-fb-db/DB_Outputs.xml"
download "$RAW/kasi09/TIA-Tools/master/examples/xml/FC_DataProcess.xml" \
  "$BASE/01-siemens-tia-portal/05-mixed-complexity-fb-db/FC_DataProcess.xml"
download "$RAW/kasi09/TIA-Tools/master/examples/xml/IO_Tags.xml" \
  "$BASE/01-siemens-tia-portal/05-mixed-complexity-fb-db/IO_Tags.xml"
download "$RAW/gabrieleNaso/PLConversionTool/main/datasets/typicals/globaldb/db_1.xml" \
  "$BASE/01-siemens-tia-portal/05-mixed-complexity-fb-db/globaldb_db_1.xml"
download "$RAW/dlevine6487/modular-application-creator-HVAC/main/TiaPortal_Export_Files/FB100_EM_SupplyFan.xml" \
  "$BASE/01-siemens-tia-portal/05-mixed-complexity-fb-db/FB100_EM_SupplyFan.xml"
download "$RAW/dlevine6487/Siemens_PLC_Compare/PLC_Compare/data/GlobalDB.xml" \
  "$BASE/01-siemens-tia-portal/05-mixed-complexity-fb-db/GlobalDB.xml"

# 6 - Bonus SCL
download "$RAW/dlevine6487/modular-application-creator-HVAC/main/TiaPortal_Export_Files/FB400_EM_Damper.xml" \
  "$BASE/01-siemens-tia-portal/06-bonus-scl/FB400_EM_Damper_SCL.xml"
download "$RAW/quocvuong-cncp/PLC_MultiAgent_SCl/master/PID_multiAgent_SCL/output/xml/FB_VFDPump.xml" \
  "$BASE/01-siemens-tia-portal/06-bonus-scl/FB_VFDPump_SCL.xml"
download "$RAW/siemens/tia-portal-openness-code-snippets/main/src/TiaPortal.Openness.CodeSnippets.Plain.Step7/PLC/ProgramBlocks/Resources/PLCBlocks/Block_4" \
  "$BASE/01-siemens-tia-portal/06-bonus-scl/siemens_openness_Block_4_SCL.xml"

# 7 - Additional Siemens samples
download "$RAW/kasi09/TIA-Tools/master/examples/xml/Startup_OB100.xml" \
  "$BASE/01-siemens-tia-portal/07-additional-samples/Startup_OB100.xml"
download "$RAW/CJMORE66/Garett-GMT-OP010/main/EXPORT/Program%20blocks/OP010/03_Auto/A1_TableLoad%26Scan/ST10_Flow2_A1TableUnloading.xml" \
  "$BASE/01-siemens-tia-portal/07-additional-samples/ST10_Flow2_A1TableUnloading_GRAPH.xml"

echo ""
echo "=== Rockwell Studio 5000 (.L5X) ==="

# 1 - Simple RLL
download "$RAW/ns-bhandari/PLC-Exercises/main/02.01-Turn%20on%20lamp%20with%20a%20push%20button/Studio5000/Ex_2_01.L5X" \
  "$BASE/02-rockwell-studio5000/01-simple-rll/Ex_2_01_simple_lamp.L5X"
download "$RAW/ns-bhandari/PLC-Exercises/main/02.03-Turn%20off%20Light%20with%20a%20push%20button/Studio5000/Ex_2_03.L5X" \
  "$BASE/02-rockwell-studio5000/01-simple-rll/Ex_2_03_turn_off_light.L5X"

# 2 - Branches + seal-in
download "$RAW/ns-bhandari/PLC-Exercises/main/02.10-Programming%20of%20Self-Hold/Studio5000/Ex_2_10.L5X" \
  "$BASE/02-rockwell-studio5000/02-branches-seal-in/Ex_2_10_self_hold_seal_in.L5X"
download "$RAW/ns-bhandari/PLC-Exercises/main/02.04-Turn%20on%20light%20with%20one%20of%20the%20two%20push%20buttons/Studio5000/Ex_2_04.L5X" \
  "$BASE/02-rockwell-studio5000/02-branches-seal-in/Ex_2_04_or_branches.L5X"
download "$RAW/danielCamiloP/TecnomecatroniX/main/7%20Controladores%20Industriales/Programas%20PLCs/Rutinas%20sueltas/Difurcaci%C3%B3n.L5X" \
  "$BASE/02-rockwell-studio5000/02-branches-seal-in/Difurcacion_branches.L5X"

# 3 - Timers + counters + math
download "$RAW/ns-bhandari/PLC-Exercises/main/02.13-Filling%20Water%20into%20jerrycans/Studio5000/Ex_2_13.L5X" \
  "$BASE/02-rockwell-studio5000/03-timers-counters-math/Ex_2_13_filling_water.L5X"
download "$RAW/petem903/studio5000-learning/main/02-conveyor/MyFirstPLCProject.L5X" \
  "$BASE/02-rockwell-studio5000/03-timers-counters-math/MyFirstPLCProject_timers_counters.L5X"
download "$RAW/danielCamiloP/TecnomecatroniX/main/7%20Controladores%20Industriales/Programas%20PLCs/Rutinas%20sueltas/LD_Bandas.L5X" \
  "$BASE/02-rockwell-studio5000/03-timers-counters-math/LD_Bandas_timers_ctu.L5X"
download "$RAW/RockwellAutomation/ra-logix-cicd/main/1-production-files/L5Xs/DelayedSum_AOI.L5X" \
  "$BASE/02-rockwell-studio5000/03-timers-counters-math/DelayedSum_AOI_ton_cpt.L5X"

# 4 - FBD
download "$RAW/tnunnink/L5Sharp/main/tests/L5Sharp.Tests.Samples/Routines/FBD.L5X" \
  "$BASE/02-rockwell-studio5000/04-fbd/L5Sharp_FBD.L5X"
download "$RAW/nickytoothiccy/_LazyTool/main/templates_PLC/YV_07670_Routine_FBD.L5X" \
  "$BASE/02-rockwell-studio5000/04-fbd/YV_07670_Routine_FBD.L5X"
download "$RAW/nickytoothiccy/_LazyTool/main/templates_PLC/PIC_07002.L5X" \
  "$BASE/02-rockwell-studio5000/04-fbd/PIC_07002_FBD.L5X"

# 5 - Full project + tags
download "$RAW/tnunnink/L5Sharp/main/tests/L5Sharp.Tests.Samples/Projects/Simple.L5X" \
  "$BASE/02-rockwell-studio5000/05-full-project-tags/Simple_project.L5X"
download "$RAW/tnunnink/L5Sharp/main/tests/L5Sharp.Tests.Samples/Projects/LotOfTags.L5X" \
  "$BASE/02-rockwell-studio5000/05-full-project-tags/LotOfTags_project.L5X"
download "$RAW/tnunnink/L5Sharp/main/tests/L5Sharp.Tests.Samples/Projects/Test.L5X" \
  "$BASE/02-rockwell-studio5000/05-full-project-tags/Test_project.L5X"
download "$RAW/Biswajit7777/AcesysCodeConversion/main/Fls.AcesysConversion.Tests/TestFiles/Tags/_501CS100%20-%20TAGS%20-%20O2O.L5X" \
  "$BASE/02-rockwell-studio5000/05-full-project-tags/_501CS100_controller_tags.L5X"
download "$RAW/RockwellAutomation/ra-logix-designer-vcs-custom-tools/main/e2e_tests/fixtures/minimal.L5X" \
  "$BASE/02-rockwell-studio5000/05-full-project-tags/minimal_controller_v38.L5X"
download "$RAW/tnunnink/L5Sharp/main/tests/L5Sharp.Tests.Samples/DataTypes/MultipleDataTypes.L5X" \
  "$BASE/02-rockwell-studio5000/05-full-project-tags/MultipleDataTypes_udt.L5X"

# 6 - Bonus AOI + SFC + ST
download "$RAW/atmassey/LogixAOIs/main/Card_Reader_Driver_AOI.L5X" \
  "$BASE/02-rockwell-studio5000/06-bonus-aoi/Card_Reader_Driver_AOI.L5X"
download "$RAW/JeremyMedders/LogixLibraries/main/src/Math/LmExpX_AOI.L5X" \
  "$BASE/02-rockwell-studio5000/06-bonus-aoi/LmExpX_AOI.L5X"
download "$RAW/tnunnink/L5Sharp/main/tests/L5Sharp.Tests.Samples/Routines/SFC.L5X" \
  "$BASE/02-rockwell-studio5000/06-bonus-aoi/L5Sharp_SFC.L5X"
download "$RAW/tnunnink/L5Sharp/main/tests/L5Sharp.Tests.Samples/Routines/ST.L5X" \
  "$BASE/02-rockwell-studio5000/06-bonus-aoi/L5Sharp_ST.L5X"

# 7 - Additional Rockwell
download "$RAW/tnunnink/L5Sharp/main/tests/L5Sharp.Tests.Samples/Routines/Main.L5X" \
  "$BASE/02-rockwell-studio5000/07-additional-samples/Main_RLL_routine.L5X"
download "$RAW/teddy19991002/AB_PLC_SIMULATIONS/main/Conveyor/MainProgram.L5X" \
  "$BASE/02-rockwell-studio5000/07-additional-samples/Conveyor_MainProgram.L5X"
download "$RAW/hutcheb/acd/main/resources/ACDTestsEmptyRedundant.L5X" \
  "$BASE/02-rockwell-studio5000/07-additional-samples/ACDTestsEmptyRedundant.L5X"

echo ""
echo "=== Schneider Control Expert (.XEF / .ZEF) ==="

download "$RAW/estradege/controlexpert/main/ControlExpert/ControlExpert.XefTests/Stu/m340.xef" \
  "$BASE/03-schneider-control-expert/01-full-projects/m340.xef"
download "$RAW/estradege/controlexpert/main/ControlExpert/ControlExpert.XefTests/Stu/m580-safety.xef" \
  "$BASE/03-schneider-control-expert/01-full-projects/m580-safety.xef"
download "$RAW/estradege/controlexpert/main/ControlExpert/ControlExpert.XefTests/Stu/m340.zef" \
  "$BASE/03-schneider-control-expert/01-full-projects/m340.zef"
download "$RAW/estradege/controlexpert/main/ControlExpert/ControlExpert.XefTests/Stu/m580-safety.zef" \
  "$BASE/03-schneider-control-expert/01-full-projects/m580-safety.zef"
download "$RAW/pupenasan/PACFramework/master/platforms/unitypro/sim_wthout_framework.xef" \
  "$BASE/03-schneider-control-expert/01-full-projects/sim_without_framework.xef"
download "$RAW/PsyGlo/Deterministic-Multi-Grafcet-Implementation/main/Logic_Source/MultiGrafcet_Coordination_V1_2026.XEF" \
  "$BASE/03-schneider-control-expert/01-full-projects/MultiGrafcet_Coordination_V1_2026.XEF"
download "$RAW/asu-in-ua/atpv/main/filedbus/cia402/atv71m340.xef" \
  "$BASE/03-schneider-control-expert/01-full-projects/atv71m340.xef"

echo ""
echo "=== PLCopen TC6 Reference (beremiz) ==="

download "$RAW/beremiz/beremiz/python3/tests/projects/iec61131_lang_test/plc.xml" \
  "$BASE/04-plcopen-tc6-reference/beremiz-tests/iec61131_lang_test_plc.xml"
download "$RAW/beremiz/beremiz/python3/exemples/first_steps/plc.xml" \
  "$BASE/04-plcopen-tc6-reference/beremiz-examples/first_steps_plc.xml"
download "$RAW/beremiz/beremiz/python3/exemples/modbus/plc.xml" \
  "$BASE/04-plcopen-tc6-reference/beremiz-examples/modbus_plc.xml"
download "$RAW/beremiz/beremiz/python3/exemples/svghmi_traffic_light/plc.xml" \
  "$BASE/04-plcopen-tc6-reference/beremiz-examples/traffic_light_plc.xml"

echo ""
echo "=== Download complete ==="
find "$BASE" -type f ! -name 'download_all.sh' ! -name '*.md' | wc -l | xargs echo "Total files:"
echo "Failed downloads: $FAILED"
exit 0
