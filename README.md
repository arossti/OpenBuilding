Sankey Visualizer with interactive controls for use with OBJECTIVE static TEUI3 Energy and Carbon Building Economics Engine by OpenBuilding, a Canadian Nonprofit in the AEC Sector. 

Value State Management:


There's a ValueState class that manages three states: default, imported, and user-edited
Each global value (COP, MVHR, DWHR) has its own ValueState instance
The class includes validation and normalization logic for values


Import Process Flow:


File handling is split between CSV and Excel paths in the FileHandler class
Both paths attempt to update global values and node/link data
The pendingImportData variable stores imported data until "Apply Changes" is clicked


Potential Issues:

a) State Synchronization:

Window globals (COPh, MVHR, etc.) and ValueState instances may get out of sync
Reset functionality might not properly distinguish between default and imported states
Some updates bypass the ValueState system and modify window globals directly

b) Import Application:

handleApplyChanges() preserves current globals before applying new data
This preservation might override imported values unintentionally
The order of operations between global updates and data updates isn't clearly defined

c) Reset Logic:

Reset attempts to restore imported state but might fall back to defaults inconsistently
The distinction between "no imports made" and "imports exist" isn't clearly tracked


Critical Flow Points:


Initial data loading
File import
Apply changes
Reset
User edits
Mode switching (gas/heat pump)
