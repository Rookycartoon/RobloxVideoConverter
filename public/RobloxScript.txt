local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

-- ===== SETTINGS =====
local LOOP = true
local MAX_DISTANCE = 120 -- studs, pause when player far
local PIXELS_PER_STUD = 140 -- visual sharpness

-- ===== LOAD VIDEO =====
local data = require(script:WaitForChild("VideoData"))
local W, H, FPS = data.Width, data.Height, data.FPS
local Frames = data.Frames

assert(W and H and FPS and Frames, "VideoData invalid")

local gui = script.Parent
local screenPart = gui.Parent
gui.Face = Enum.NormalId.Front
gui.CanvasSize = Vector2.new(W, H)
gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
gui.PixelsPerStud = PIXELS_PER_STUD

-- ===== CLEAR OLD =====
local old = gui:FindFirstChild("Container")
if old then old:Destroy() end

-- ===== CONTAINER =====
local container = Instance.new("Frame")
container.Name = "Container"
container.Size = UDim2.fromScale(1, 1)
container.BackgroundTransparency = 1
container.Parent = gui

-- ===== BUILD GRID ONCE =====
local totalBlocks = W * H
local blocks = table.create(totalBlocks)

do
	local idx = 1
	for y = 0, H - 1 do
		for x = 0, W - 1 do
			local px = Instance.new("Frame")
			px.BorderSizePixel = 0
			px.BackgroundColor3 = Color3.new(0, 0, 0)
			px.Position = UDim2.new(x / W, 0, y / H, 0)
			px.Size = UDim2.new(1 / W, 0, 1 / H, 0)
			px.Parent = container

			blocks[idx] = px
			idx += 1
		end
		if y % 8 == 0 then task.wait() end
	end
end

print(("✅ Grid built: %dx%d (%d blocks)"):format(W, H, totalBlocks))
print(("✅ Frames: %d @ %d FPS"):format(#Frames, FPS))

-- ===== COLOR CACHE =====
local colorCache = {}
local function getColor(r, g, b)
	local key = r * 65536 + g * 256 + b
	local c = colorCache[key]
	if not c then
		c = Color3.fromRGB(r, g, b)
		colorCache[key] = c
	end
	return c
end

-- ===== APPLY FRAME 1 (FULL) =====
local function applyFullFrame(arr)
	-- arr: r,g,b,r,g,b...
	local bi = 1
	local i = 1
	while i <= #arr do
		local r, g, b = arr[i], arr[i+1], arr[i+2]
		i += 3

		local obj = blocks[bi]
		if obj then
			obj.BackgroundColor3 = getColor(r, g, b)
		end
		bi += 1
	end
end

-- ===== APPLY DELTA FRAME =====
local function applyDelta(arr)
	-- arr: index,r,g,b,index,r,g,b...
	local i = 1
	while i <= #arr do
		local index = arr[i]
		local r = arr[i+1]
		local g = arr[i+2]
		local b = arr[i+3]
		i += 4

		local obj = blocks[index]
		if obj then
			obj.BackgroundColor3 = getColor(r, g, b)
		end
	end
end

-- ===== DISTANCE CULLING =====
local function playerCloseEnough()
	local plr = Players.LocalPlayer
	if not plr then return true end
	local char = plr.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	if not hrp then return true end

	return (hrp.Position - screenPart.Position).Magnitude <= MAX_DISTANCE
end

-- ===== PLAYBACK =====
applyFullFrame(Frames[1]) -- first full frame

local frameTime = 1 / FPS
local frameIndex = 1
local acc = 0

RunService.Heartbeat:Connect(function(dt)
	-- pause when player far
	if not playerCloseEnough() then
		return
	end

	acc += dt
	while acc >= frameTime do
		acc -= frameTime
		frameIndex += 1

		if frameIndex > #Frames then
			if LOOP then
				frameIndex = 1
				applyFullFrame(Frames[1]) -- reset to full
			else
				return
			end
		else
			applyDelta(Frames[frameIndex])
		end
	end
end)

print("✅ Delta video started")
