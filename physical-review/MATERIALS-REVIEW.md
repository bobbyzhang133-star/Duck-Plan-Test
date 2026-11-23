# DuckPlan V4.3 physical prototype — materials Chat Check

Review request: assess the shopping list against the linked DuckPlan V4.3 physical plan, the prototype CAD and the actual CrowPanel Advance 7-inch ESP32-S3, 800x480. Focus on essential missing materials, incorrect or incompatible parts, risks, quantities, supplier sources and next actions. Explain which choices are verified, tentative or blocked. Do not deploy or order anything.

Original plan and latest discussion: https://chatgpt.com/g/g-p-6addac00e55c8191a3f6db4456733345-duck-plan/c/6b0330c0-bae4-83e8-b734-634334645a41

Initial candidate list to evaluate, not an approved final bill of materials:
- Elecrow CrowPanel Advance 7-inch ESP32-S3 800x480: https://www.elecrow.com/crowpanel-advance-7-hmi-esp32-ai-display-800x480-ai-ips-touch-screen.html
- Adafruit mini oval speaker 3923, 8 ohm 1 W, 30x20x5 mm: https://www.adafruit.com/product/3923
- PH 2 mm two-pin pigtail to adapt speaker: https://www.adafruit.com/product/261 ; optional PicoBlade mate https://www.adafruit.com/product/4720
- Two 6 mm momentary switches (Adafruit 367), 6x6x5 mm: https://www.adafruit.com/product/367
- Switch wire: https://www.adafruit.com/product/3890
- Feet: https://www.adafruit.com/product/550
- 5 V 2 A power, USB cable, PETG, hinge pin, fasteners, return springs or equivalent and a stand stop, as needed.
- Optional I2C expander if compatible GPIO are not readily available: https://www.adafruit.com/product/5346 . Verify 3.3 V, connector wiring, pin/address conflicts and board revision; it is not plug-and-play with CrowPanel.

Known incompatibility: Elecrow specifies PH2.0-2P for the speaker port while the Adafruit speaker has a 1.25 mm PicoBlade plug. Connector adaptation, polarity and amplifier suitability need checking. The V4.3 prototype is not print-ready; real hardware, switch mechanisms, supports and stability require verification. Source and explicit open issues are in DuckPlan-physical-v4.3-prototype/README.md. The prototype switch references are 6x6x3 mm, which differ from the 6x6x5 mm candidate.

Use manufacturer or product documentation; distinguish evidence from assumptions and identify what cannot be verified. No full mechanical operation, printability or product stability has been established.
