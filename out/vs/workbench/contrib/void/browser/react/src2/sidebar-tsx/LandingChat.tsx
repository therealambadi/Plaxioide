/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt in project root.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useRef, useState } from 'react';
import { VoidChatArea } from './SidebarChat.js';
import { VoidInputBox2, TextAreaFns } from '../util/inputs.js';
import { useIsDark } from '../util/services.js';
import '../styles.css';

// Custom event name — editorGroupWatermark listens for this
export const VOLT_SUBMIT_EVENT = 'volt:landing:submit';

const EXAMPLE_PROMPTS = [
'PLC motor start/stop with E-stop interlock',
'Water treatment plant control system',
'Conveyor belt with safety interlocks',
'Arduino traffic light with pedestrian button',
'ESP32 temperature monitor with DHT22'];


export const LandingChat = () => {
  const isDark = useIsDark();
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const textAreaFnsRef = useRef<TextAreaFns | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const submit = useCallback((forceMsg?: string) => {
    const msg = forceMsg ?? textAreaRef.current?.value ?? '';
    if (!msg.trim()) return;
    // Dispatch custom event so the VS Code layer (editorGroupWatermark) can handle it
    window.dispatchEvent(new CustomEvent(VOLT_SUBMIT_EVENT, { detail: { message: msg } }));
    textAreaFnsRef.current?.setValue('');
  }, []);

  return (
    <div className={`void-scope ${isDark ? "void-dark" : ""}`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
			<div style={{ width: '560px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>

				{/* Hero */}
				<h1 className="void-text-void-fg-1" style={{ fontSize: 28, fontWeight: 600, textAlign: 'center', margin: '0 0 8px 0', lineHeight: 1.3 }}>
					Build intelligent PLC programs with AI
				</h1>
				<p className="void-text-void-fg-3" style={{ fontSize: 13, textAlign: 'center', margin: '0 0 24px 0' }}>
					Build PLC programs with AI-powered simulation.
				</p>

				{/* Chat input — exact same VoidChatArea as the sidebar */}
				<div style={{ width: '100%' }}>
					<VoidChatArea
            featureName="Chat"
            onSubmit={() => submit()}
            onAbort={() => {}}
            isStreaming={false}
            isDisabled={isEmpty}
            showModelDropdown={true}
            onClickAnywhere={() => textAreaRef.current?.focus()}>

						<VoidInputBox2
              enableAtToMention={false}
              transparentBg
              className="void-void-min-h-[100px] void-void-px-0.5 void-void-py-0.5"
              placeholder="Describe what to build..."
              onChangeText={(val) => setIsEmpty(!val.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              ref={textAreaRef}
              fnsRef={textAreaFnsRef}
              multiline={true} />

					</VoidChatArea>
				</div>

				{/* Example chips */}
				<div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 18 }}>
					{EXAMPLE_PROMPTS.map((text) =>
          <button
            key={text}
            className="void-text-void-fg-3 void-bg-void-bg-2 void-border void-border-void-border-3 hover:void-border-void-border-1 void-rounded-full"
            style={{ padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => {
              textAreaFnsRef.current?.setValue(text);
              textAreaRef.current?.focus();
              setIsEmpty(false);
            }}>

							{text}
						</button>
          )}
				</div>

			</div>
		</div>);

};